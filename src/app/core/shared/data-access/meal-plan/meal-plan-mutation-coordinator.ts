import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';

import { ResettableStore } from '../../utils/resettable-store';
import { MealPlanContextStore } from './meal-plan-context.store';
import {
  MealPlanMutationOperation,
  MealPlanMutationReceipt,
  MealPlanMutationStatus,
  MealPlanOperationOutcome,
  MealPlanOperationResult,
} from './meal-plan-mutation.model';
import { MealPlanRevision } from './meal-plan.model';
import { MealPlanSyncService } from './meal-plan-sync.service';

export interface MealPlanMutationCoordinatorState {
  readonly status: MealPlanMutationStatus;
  readonly activeOperationId: number | null;
  readonly queuedCount: number;
  readonly paused: boolean;
  readonly lastResult: MealPlanOperationResult | null;
}

interface QueuedOperation {
  readonly id: number;
  readonly generation: number;
  readonly identityGeneration: number;
  authorityRevision: MealPlanRevision;
  readonly operation: MealPlanMutationOperation;
  readonly result: ReplaySubject<MealPlanOperationResult>;
  settled: boolean;
}

const INITIAL_STATE: MealPlanMutationCoordinatorState = {
  status: 'idle',
  activeOperationId: null,
  queuedCount: 0,
  paused: false,
  lastResult: null,
};

/** One in-memory FIFO lane for every Meal Plan state-changing request. */
@Injectable({ providedIn: 'root' })
export class MealPlanMutationCoordinator implements ResettableStore {
  private readonly context = inject(MealPlanContextStore);
  private readonly sync = inject(MealPlanSyncService);
  private readonly stateSignal = signal<MealPlanMutationCoordinatorState>(INITIAL_STATE);
  private readonly queue: QueuedOperation[] = [];
  private readonly idleWaiters: Array<() => void> = [];
  private readonly settledWaiters: Array<() => void> = [];
  private active: QueuedOperation | null = null;
  private nextOperationId = 1;
  private coordinatorGeneration = 0;

  readonly state = this.stateSignal.asReadonly();
  readonly status = computed(() => this.stateSignal().status);
  readonly pending = computed(() => {
    const state = this.stateSignal();
    return state.activeOperationId !== null || state.queuedCount > 0;
  });
  readonly paused = computed(() => this.stateSignal().paused);
  readonly lastResult = computed(() => this.stateSignal().lastResult);

  constructor() {
    this.sync.changed$.subscribe(event => {
      if ((event.kind === 'readAdvanced' || event.kind === 'reconciliationRequired')
        && (this.active !== null || this.queue.length > 0)) {
        this.pause('conflict');
      }
    });
  }

  enqueue(operation: MealPlanMutationOperation): Observable<MealPlanOperationResult> {
    const id = this.nextOperationId++;
    const result = new ReplaySubject<MealPlanOperationResult>(1);
    const currentRevision = this.context.revision();
    const generation = this.context.identityGeneration();

    if (this.paused() || currentRevision !== operation.context.expectedRevision) {
      const rejected: MealPlanOperationResult = {
        operationId: id,
        kind: operation.context.kind,
        outcome: 'conflict',
        revision: currentRevision,
      };
      result.next(rejected);
      result.complete();
      this.stateSignal.update(state => ({
        ...state,
        status: 'conflict',
        paused: true,
        lastResult: rejected,
      }));
      return result.asObservable();
    }

    if (operation.mode === 'structural' && operation.dedupeKey
      && this.hasOutstandingDedupeKey(operation.dedupeKey)) {
      this.emitImmediate(result, id, operation, 'duplicate');
      return result.asObservable();
    }

    if (operation.mode === 'scalar' && operation.coalesceKey) {
      const existingIndex = this.queue.findIndex(job =>
        job.operation.mode === 'scalar'
        && job.operation.coalesceKey === operation.coalesceKey);
      if (existingIndex >= 0) {
        const [superseded] = this.queue.splice(existingIndex, 1);
        if (superseded) this.settle(superseded, 'superseded', null);
      }
    }

    this.queue.push({
      id,
      generation: this.coordinatorGeneration,
      identityGeneration: generation,
      authorityRevision: currentRevision,
      operation,
      result,
      settled: false,
    });
    this.updateQueueState();
    this.drain();
    return result.asObservable();
  }

  flush(): Promise<void> {
    this.drain();
    return this.waitUntilIdle();
  }

  waitUntilIdle(): Promise<void> {
    if (this.active === null && this.queue.length === 0) return Promise.resolve();
    return new Promise(resolve => this.idleWaiters.push(resolve));
  }

  /** A paused queue is settled for navigation/reconciliation, but is never replayed. */
  waitUntilSettled(): Promise<void> {
    if (this.active === null && (this.queue.length === 0 || this.paused())) return Promise.resolve();
    return new Promise(resolve => this.settledWaiters.push(resolve));
  }

  /** Reconciliation never replays old work; callers explicitly submit reviewed intents again. */
  clearPauseAfterReconciliation(): void {
    for (const job of this.queue.splice(0)) this.settle(job, 'cancelled', null);
    this.stateSignal.update(state => ({
      ...state,
      status: this.active === null ? 'idle' : state.status,
      paused: false,
      queuedCount: 0,
    }));
    this.resolveIdleIfNeeded();
  }

  cancelUnsent(resourceKey?: string): void {
    for (let index = this.queue.length - 1; index >= 0; index--) {
      const job = this.queue[index];
      if (job && (resourceKey === undefined || job.operation.resourceKey === resourceKey)) {
        this.queue.splice(index, 1);
        this.settle(job, 'cancelled', null);
      }
    }
    this.updateQueueState();
    this.resolveIdleIfNeeded();
  }

  reset(): void {
    this.coordinatorGeneration++;
    const jobs = [...this.queue];
    this.queue.length = 0;
    if (this.active !== null) jobs.push(this.active);
    for (const job of jobs) this.settle(job, 'cancelled', null);
    this.active = null;
    // The in-flight transport is not treated as rolled back; its generation callback is ignored.
    this.stateSignal.set(INITIAL_STATE);
    this.resolveIdleIfNeeded();
  }

  private drain(): void {
    if (this.active !== null || this.paused()) return;
    const job = this.queue.shift();
    if (!job) {
      this.updateQueueState();
      this.resolveIdleIfNeeded();
      return;
    }

    if (job.generation !== this.coordinatorGeneration
      || !this.context.isGenerationCurrent(job.identityGeneration)
      || this.context.revision() !== job.authorityRevision) {
      this.settle(job, 'conflict', this.context.revision());
      this.pause('conflict');
      return;
    }

    this.active = job;
    this.context.advanceReadEpoch();
    this.stateSignal.update(state => ({
      ...state,
      status: 'pending',
      activeOperationId: job.id,
      queuedCount: this.queue.length,
    }));

    let received = false;
    job.operation.execute(job.authorityRevision).subscribe({
      next: receipt => {
        if (received) return;
        received = true;
        this.handleReceipt(job, receipt);
      },
      error: error => this.handleError(job, error),
      complete: () => {
        if (!received) this.handleError(job, new Error('Mutation completed without a receipt'));
      },
    });
  }

  private handleReceipt(job: QueuedOperation, receipt: MealPlanMutationReceipt): void {
    if (!this.isJobCurrent(job)) return;
    const applied = this.sync.applyMutationReceipt(
      job.operation.context.kind,
      job.authorityRevision,
      receipt,
      job.identityGeneration
    );
    if (!applied) {
      this.finishActive(job, 'conflict', null, undefined);
      this.pause('conflict');
      return;
    }

    for (const queued of this.queue) {
      if (queued.authorityRevision === job.authorityRevision) {
        queued.authorityRevision = receipt.revision;
      }
    }
    this.cancelDeletedDependents(job.operation.deletesResourceKeys ?? []);
    this.finishActive(job, 'confirmed', receipt.revision, undefined);
    this.drain();
  }

  private handleError(job: QueuedOperation, error: unknown): void {
    if (!this.isJobCurrent(job)) return;
    const { outcome, status, code } = classifyMutationError(error);
    this.finishActive(job, outcome, null, status, code);
    if (outcome === 'conflict' || outcome === 'unknownOutcome') {
      this.pause(outcome);
    } else {
      this.drain();
    }
  }

  private finishActive(
    job: QueuedOperation,
    outcome: MealPlanOperationOutcome,
    revision: MealPlanRevision | null,
    httpStatus?: number,
    code?: string
  ): void {
    this.settle(job, outcome, revision, httpStatus, code);
    if (this.active === job) this.active = null;
    const status: MealPlanMutationStatus = outcome === 'confirmed'
      ? 'idle'
      : outcome === 'conflict'
        ? 'conflict'
        : outcome === 'unknownOutcome'
          ? 'unknownOutcome'
          : 'failed';
    this.stateSignal.update(state => ({
      ...state,
      status,
      activeOperationId: null,
      queuedCount: this.queue.length,
    }));
    this.resolveIdleIfNeeded();
  }

  private pause(status: 'conflict' | 'unknownOutcome'): void {
    this.stateSignal.update(state => ({ ...state, status, paused: true }));
    this.resolveIdleIfNeeded();
  }

  private cancelDeletedDependents(deletedKeys: readonly string[]): void {
    if (deletedKeys.length === 0) return;
    const deleted = new Set(deletedKeys);
    for (let index = this.queue.length - 1; index >= 0; index--) {
      const job = this.queue[index];
      if (job?.operation.dependsOn?.some(key => deleted.has(key))) {
        this.queue.splice(index, 1);
        this.settle(job, 'cancelled', this.context.revision());
      }
    }
  }

  private hasOutstandingDedupeKey(key: string): boolean {
    return this.active?.operation.dedupeKey === key
      || this.queue.some(job => job.operation.dedupeKey === key);
  }

  private isJobCurrent(job: QueuedOperation): boolean {
    return this.active === job && job.generation === this.coordinatorGeneration;
  }

  private settle(
    job: QueuedOperation,
    outcome: MealPlanOperationOutcome,
    revision: MealPlanRevision | null,
    httpStatus?: number,
    code?: string
  ): void {
    if (job.settled) return;
    job.settled = true;
    const result: MealPlanOperationResult = {
      operationId: job.id,
      kind: job.operation.context.kind,
      outcome,
      revision,
      ...(httpStatus === undefined ? {} : { httpStatus }),
      ...(code === undefined ? {} : { code }),
    };
    job.result.next(result);
    job.result.complete();
    this.stateSignal.update(state => ({ ...state, lastResult: result }));
  }

  private emitImmediate(
    subject: ReplaySubject<MealPlanOperationResult>,
    id: number,
    operation: MealPlanMutationOperation,
    outcome: 'duplicate'
  ): void {
    const result: MealPlanOperationResult = {
      operationId: id,
      kind: operation.context.kind,
      outcome,
      revision: this.context.revision(),
    };
    subject.next(result);
    subject.complete();
    this.stateSignal.update(state => ({ ...state, lastResult: result }));
  }

  private updateQueueState(): void {
    this.stateSignal.update(state => ({ ...state, queuedCount: this.queue.length }));
  }

  private resolveIdleIfNeeded(): void {
    if (this.active === null && (this.queue.length === 0 || this.paused())) {
      for (const resolve of this.settledWaiters.splice(0)) resolve();
    }
    if (this.active !== null || this.queue.length !== 0) return;
    for (const resolve of this.idleWaiters.splice(0)) resolve();
  }
}

function classifyMutationError(error: unknown): {
  readonly outcome: 'failed' | 'conflict' | 'unknownOutcome';
  readonly status?: number;
  readonly code?: string;
} {
  if (!(error instanceof HttpErrorResponse)) return { outcome: 'unknownOutcome' };
  const code = typeof error.error === 'object' && error.error !== null
    && typeof (error.error as { code?: unknown }).code === 'string'
    ? (error.error as { code: string }).code
    : undefined;
  if (error.status === 409) return { outcome: 'conflict', status: 409, ...(code ? { code } : {}) };
  if (error.status === 0 || error.status === 408 || error.status >= 500) {
    return { outcome: 'unknownOutcome', status: error.status, ...(code ? { code } : {}) };
  }
  return { outcome: 'failed', status: error.status, ...(code ? { code } : {}) };
}

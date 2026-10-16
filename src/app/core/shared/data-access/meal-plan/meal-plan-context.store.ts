import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';

import { ResettableStore } from '../../utils/resettable-store';
import { MealPlanRevision, MealPlanSettingsDto } from './meal-plan.model';

export interface MealPlanQueryToken {
  readonly identityGeneration: number;
  readonly queryKey: string;
  readonly requestSequence: number;
  readonly readEpoch: number;
  readonly invalidationVersion: number;
}

export interface MealPlanContextState {
  readonly revision: MealPlanRevision | null;
  readonly settings: MealPlanSettingsDto | null;
  readonly identityGeneration: number;
  readonly readEpoch: number;
}

function initialState(identityGeneration = 0, readEpoch = 0): MealPlanContextState {
  return {
    revision: null,
    settings: null,
    identityGeneration,
    readEpoch,
  };
}

/** Root identity context shared by Meal Plan query stores and later synchronization phases. */
@Injectable({ providedIn: 'root' })
export class MealPlanContextStore implements ResettableStore {
  private readonly stateSignal = signal<MealPlanContextState>(initialState());
  private readonly resetSubject = new Subject<number>();

  readonly state = this.stateSignal.asReadonly();
  readonly revision = computed(() => this.stateSignal().revision);
  readonly settings = computed(() => this.stateSignal().settings);
  readonly identityGeneration = computed(() => this.stateSignal().identityGeneration);
  readonly readEpoch = computed(() => this.stateSignal().readEpoch);
  readonly reset$ = this.resetSubject.asObservable();

  isGenerationCurrent(identityGeneration: number): boolean {
    return this.identityGeneration() === identityGeneration;
  }

  replaceConfirmedContext(
    revision: MealPlanRevision,
    settings: MealPlanSettingsDto,
    identityGeneration: number
  ): boolean {
    if (!this.isGenerationCurrent(identityGeneration)) return false;
    this.stateSignal.update(state => ({ ...state, revision, settings }));
    return true;
  }

  replaceConfirmedRevision(
    revision: MealPlanRevision,
    identityGeneration: number
  ): boolean {
    if (!this.isGenerationCurrent(identityGeneration)) return false;
    this.stateSignal.update(state => ({ ...state, revision }));
    return true;
  }

  invalidateConfirmedContext(identityGeneration: number): boolean {
    if (!this.isGenerationCurrent(identityGeneration)) return false;
    this.stateSignal.update(state => ({ ...state, revision: null, settings: null }));
    return true;
  }

  /** Invalidates reads captured before a write or explicit reconciliation boundary. */
  advanceReadEpoch(): number {
    const next = this.readEpoch() + 1;
    this.stateSignal.update(state => ({ ...state, readEpoch: next }));
    return next;
  }

  reset(): void {
    const identityGeneration = this.identityGeneration() + 1;
    const readEpoch = this.readEpoch() + 1;
    this.stateSignal.set(initialState(identityGeneration, readEpoch));
    this.resetSubject.next(identityGeneration);
  }
}

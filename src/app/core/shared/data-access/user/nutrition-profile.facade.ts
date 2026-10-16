import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, catchError, finalize, map, mergeMap, of, shareReplay, throwError } from 'rxjs';

import { toApiErrorMessage } from '../generic-template/api-error-message';
import { MealPlanContextStore } from '../meal-plan/meal-plan-context.store';
import { MealPlanMutationCoordinator } from '../meal-plan/meal-plan-mutation-coordinator';
import { MealPlanOperationResult } from '../meal-plan/meal-plan-mutation.model';
import { MealPlanSyncService } from '../meal-plan/meal-plan-sync.service';
import { NutritionProfileDto, NutritionProfileRequest } from './nutrition-profile.model';
import { NutritionProfileStore } from './nutrition-profile.store';
import { UserApi } from './user_auth.api';

export interface NutritionProfileSaveResult extends MealPlanOperationResult {
  readonly traceId?: string;
  readonly errors?: Readonly<Record<string, readonly string[]>>;
}

/** Core use cases for the separate saved nutrition-profile contract. */
@Injectable({ providedIn: 'root' })
export class NutritionProfileFacade {
  private readonly api = inject(UserApi);
  private readonly context = inject(MealPlanContextStore);
  private readonly coordinator = inject(MealPlanMutationCoordinator);
  private readonly sync = inject(MealPlanSyncService);
  readonly store = inject(NutritionProfileStore);
  private inFlightLoad: Observable<NutritionProfileDto> | null = null;

  constructor() {
    this.context.reset$.subscribe(() => {
      this.inFlightLoad = null;
    });
  }

  load(): Observable<NutritionProfileDto> {
    if (this.inFlightLoad !== null) return this.inFlightLoad;
    const token = this.store.beginLoad(this.context.readEpoch());
    if (token === null) {
      const state = this.store.state();
      return state.loaded
        ? of({ revision: state.revision!, profile: state.profile })
        : EMPTY;
    }

    let sharedRequest: Observable<NutritionProfileDto>;
    sharedRequest = this.api.getNutritionProfile().pipe(
      mergeMap(response => this.sync.observeRead({ kind: 'profile', token, response })
        ? of(response)
        : EMPTY),
      catchError((error: unknown) => {
        this.store.failLoad(
          token,
          toApiErrorMessage(error),
          this.context.readEpoch(),
          httpStatus(error)
        );
        return throwError(() => error);
      }),
      finalize(() => {
        if (this.inFlightLoad === sharedRequest) this.inFlightLoad = null;
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    this.inFlightLoad = sharedRequest;
    return sharedRequest;
  }

  update(
    request: NutritionProfileRequest,
    expectedRevision: string
  ): Observable<NutritionProfileSaveResult> {
    let problem: Pick<NutritionProfileSaveResult, 'traceId' | 'errors'> = {};
    return this.coordinator.enqueue({
      context: { kind: 'updateNutritionProfile', expectedRevision },
      mode: 'scalar',
      resourceKey: 'nutrition-profile',
      coalesceKey: 'nutrition-profile',
      execute: revision => this.api.updateNutritionProfile(request, revision).pipe(
        catchError((error: unknown) => {
          problem = profileProblem(error);
          return throwError(() => error);
        })
      ),
    }).pipe(map(result => ({ ...result, ...problem })));
  }

  /** Only an explicitly reviewed, current GET can release a paused write lane. */
  resumeAfterReview(revision: string): boolean {
    const state = this.store.state();
    if (!state.loaded || state.stale || state.revision !== revision
      || this.context.revision() !== revision
      || this.coordinator.state().activeOperationId !== null) return false;
    this.coordinator.clearPauseAfterReconciliation();
    return true;
  }
}

function profileProblem(error: unknown): Pick<NutritionProfileSaveResult, 'traceId' | 'errors'> {
  if (typeof error !== 'object' || error === null || !('error' in error)) return {};
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) return {};
  const problem = body as { traceId?: unknown; errors?: unknown };
  const errors: Record<string, readonly string[]> = {};
  if (typeof problem.errors === 'object' && problem.errors !== null) {
    for (const [path, messages] of Object.entries(problem.errors)) {
      if (Array.isArray(messages) && messages.every(message => typeof message === 'string')) {
        errors[path] = messages;
      }
    }
  }
  return {
    ...(typeof problem.traceId === 'string' ? { traceId: problem.traceId } : {}),
    errors,
  };
}

function httpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

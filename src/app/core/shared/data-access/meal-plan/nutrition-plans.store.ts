import { Injectable, computed, signal } from '@angular/core';

import { EntityRequestState } from '../generic-template/entity-cache-store';
import { ResettableStore } from '../../utils/resettable-store';
import { MealPlanQueryToken } from './meal-plan-context.store';
import { MealPlanRevision } from './meal-plan.model';
import { NutritionPlanListDto, NutritionPlanSummaryDto } from './nutrition-plan.model';

const QUERY_KEY = 'nutrition-plans';
const IDLE_REQUEST: EntityRequestState = { status: 'idle', error: null };

export interface NutritionPlansState {
  readonly plans: readonly NutritionPlanSummaryDto[];
  readonly observedRevision: MealPlanRevision | null;
  readonly loaded: boolean;
  readonly stale: boolean;
  readonly request: EntityRequestState;
  readonly identityGeneration: number;
  readonly requestSequence: number;
  readonly invalidationVersion: number;
}

function initialState(identityGeneration = 0): NutritionPlansState {
  return {
    plans: [],
    observedRevision: null,
    loaded: false,
    stale: false,
    request: IDLE_REQUEST,
    identityGeneration,
    requestSequence: 0,
    invalidationVersion: 0,
  };
}

/** Root summary projection; complete plan details are intentionally stored elsewhere. */
@Injectable({ providedIn: 'root' })
export class NutritionPlansStore implements ResettableStore {
  private readonly stateSignal = signal<NutritionPlansState>(initialState());

  readonly state = this.stateSignal.asReadonly();
  readonly plans = computed(() => this.stateSignal().plans);
  readonly observedRevision = computed(() => this.stateSignal().observedRevision);
  readonly loaded = computed(() => this.stateSignal().loaded);
  readonly stale = computed(() => this.stateSignal().stale);
  readonly request = computed(() => this.stateSignal().request);
  readonly identityGeneration = computed(() => this.stateSignal().identityGeneration);

  beginLoad(readEpoch: number): MealPlanQueryToken | null {
    const state = this.stateSignal();
    if (state.request.status === 'loading') return null;
    const requestSequence = state.requestSequence + 1;
    this.stateSignal.update(current => ({
      ...current,
      requestSequence,
      stale: current.loaded || current.stale,
      request: { status: 'loading', error: null },
    }));
    return {
      identityGeneration: state.identityGeneration,
      queryKey: QUERY_KEY,
      requestSequence,
      readEpoch,
      invalidationVersion: state.invalidationVersion,
    };
  }

  acceptList(
    token: MealPlanQueryToken,
    response: NutritionPlanListDto,
    currentReadEpoch: number
  ): boolean {
    if (!this.isTokenCurrent(token, currentReadEpoch)) return false;
    this.stateSignal.update(state => ({
      ...state,
      plans: response.plans,
      observedRevision: response.revision,
      loaded: true,
      stale: false,
      request: { status: 'success', error: null },
    }));
    return true;
  }

  failLoad(
    token: MealPlanQueryToken,
    message: string,
    currentReadEpoch: number,
    httpStatus?: number
  ): boolean {
    if (!this.isTokenCurrent(token, currentReadEpoch)) return false;
    const request: EntityRequestState = httpStatus === undefined
      ? { status: 'error', error: message }
      : { status: 'error', error: message, httpStatus };
    this.stateSignal.update(state => ({ ...state, request }));
    return true;
  }

  invalidate(): void {
    this.stateSignal.update(state => ({
      ...state,
      stale: state.loaded,
      request: state.request.status === 'loading' ? IDLE_REQUEST : state.request,
      invalidationVersion: state.invalidationVersion + 1,
    }));
  }

  invalidateIfOlderThan(revision: MealPlanRevision): void {
    const observed = this.observedRevision();
    if (observed !== null && BigInt(observed) < BigInt(revision)) this.invalidate();
  }

  rebaseFresh(expectedRevision: MealPlanRevision, revision: MealPlanRevision): void {
    this.stateSignal.update(state => state.loaded
      && !state.stale
      && state.observedRevision === expectedRevision
      ? { ...state, observedRevision: revision }
      : state);
  }

  reset(): void {
    this.stateSignal.update(state => initialState(state.identityGeneration + 1));
  }

  private isTokenCurrent(token: MealPlanQueryToken, currentReadEpoch: number): boolean {
    const state = this.stateSignal();
    return token.queryKey === QUERY_KEY
      && token.identityGeneration === state.identityGeneration
      && token.requestSequence === state.requestSequence
      && token.readEpoch === currentReadEpoch
      && token.invalidationVersion === state.invalidationVersion;
  }
}

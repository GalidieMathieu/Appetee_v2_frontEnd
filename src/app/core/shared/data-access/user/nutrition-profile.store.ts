import { Injectable, computed, signal } from '@angular/core';

import { MealPlanQueryToken } from '../meal-plan/meal-plan-context.store';
import { MealPlanRevision } from '../meal-plan/meal-plan.model';
import { EntityRequestState } from '../generic-template/entity-cache-store';
import { ResettableStore } from '../../utils/resettable-store';
import { NutritionProfileDto, NutritionProfileValue } from './nutrition-profile.model';

const QUERY_KEY = 'nutrition-profile';
const IDLE_REQUEST: EntityRequestState = { status: 'idle', error: null };

export interface NutritionProfileState {
  readonly profile: NutritionProfileValue | null;
  readonly revision: MealPlanRevision | null;
  readonly loaded: boolean;
  readonly stale: boolean;
  readonly request: EntityRequestState;
  readonly identityGeneration: number;
  readonly requestSequence: number;
  readonly invalidationVersion: number;
}

function initialState(identityGeneration = 0): NutritionProfileState {
  return {
    profile: null,
    revision: null,
    loaded: false,
    stale: false,
    request: IDLE_REQUEST,
    identityGeneration,
    requestSequence: 0,
    invalidationVersion: 0,
  };
}

/** Root complete nullable nutrition-profile snapshot, separate from username/image state. */
@Injectable({ providedIn: 'root' })
export class NutritionProfileStore implements ResettableStore {
  private readonly stateSignal = signal<NutritionProfileState>(initialState());

  readonly state = this.stateSignal.asReadonly();
  readonly profile = computed(() => this.stateSignal().profile);
  readonly revision = computed(() => this.stateSignal().revision);
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

  acceptProfile(
    token: MealPlanQueryToken,
    response: NutritionProfileDto,
    currentReadEpoch: number
  ): boolean {
    if (!this.isTokenCurrent(token, currentReadEpoch)) return false;
    this.stateSignal.update(state => ({
      ...state,
      profile: response.profile,
      revision: response.revision,
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
    const observed = this.revision();
    if (observed !== null && BigInt(observed) < BigInt(revision)) this.invalidate();
  }

  rebaseFresh(expectedRevision: MealPlanRevision, revision: MealPlanRevision): void {
    this.stateSignal.update(state => state.loaded
      && !state.stale
      && state.revision === expectedRevision
      ? { ...state, revision }
      : state);
  }

  replaceConfirmed(
    profile: NutritionProfileValue | null,
    revision: MealPlanRevision,
    identityGeneration: number
  ): boolean {
    if (identityGeneration !== this.identityGeneration()) return false;
    this.stateSignal.update(state => ({
      ...state,
      profile,
      revision,
      loaded: true,
      stale: false,
      request: { status: 'success', error: null },
    }));
    return true;
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

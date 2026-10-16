import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MealPlanContextStore } from '../meal-plan/meal-plan-context.store';
import { MealPlanMutationCoordinator } from '../meal-plan/meal-plan-mutation-coordinator';
import { MealPlanMutationOperation } from '../meal-plan/meal-plan-mutation.model';
import { MealPlannerStore } from '../meal-plan/meal-planner.store';
import { NutritionPlanDetailsStore } from '../meal-plan/nutrition-plan-details.store';
import { NutritionPlansStore } from '../meal-plan/nutrition-plans.store';
import { NutritionProfileDto, NutritionProfileRequest } from './nutrition-profile.model';
import { NutritionProfileFacade } from './nutrition-profile.facade';
import { NutritionProfileStore } from './nutrition-profile.store';
import { UserApi } from './user_auth.api';

describe('NutritionProfileFacade', () => {
  let facade: NutritionProfileFacade;
  let context: MealPlanContextStore;
  let store: NutritionProfileStore;
  const getNutritionProfile = vi.fn();
  const updateNutritionProfile = vi.fn();
  const enqueue = vi.fn();
  const coordinatorState = vi.fn(() => ({ activeOperationId: null as number | null }));
  const clearPauseAfterReconciliation = vi.fn();

  beforeEach(() => {
    getNutritionProfile.mockReset();
    updateNutritionProfile.mockReset();
    enqueue.mockReset();
    coordinatorState.mockReturnValue({ activeOperationId: null });
    clearPauseAfterReconciliation.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: UserApi, useValue: { getNutritionProfile, updateNutritionProfile } },
        { provide: MealPlanMutationCoordinator, useValue: { enqueue, state: coordinatorState,
          clearPauseAfterReconciliation } },
      ],
    });
    facade = TestBed.inject(NutritionProfileFacade);
    context = TestBed.inject(MealPlanContextStore);
    store = TestBed.inject(NutritionProfileStore);
    context.reset();
    store.reset();
    TestBed.inject(MealPlannerStore).reset();
    TestBed.inject(NutritionPlansStore).reset();
    TestBed.inject(NutritionPlanDetailsStore).reset();
  });

  it('coalesces an in-flight load and adopts a complete nullable profile through sync', async () => {
    const response = new Subject<NutritionProfileDto>();
    getNutritionProfile.mockReturnValue(response);
    const first = firstValueFrom(facade.load());
    const second = firstValueFrom(facade.load());

    expect(getNutritionProfile).toHaveBeenCalledTimes(1);
    response.next({ revision: '8', profile: null });
    response.complete();

    await expect(first).resolves.toEqual({ revision: '8', profile: null });
    await expect(second).resolves.toEqual({ revision: '8', profile: null });
    expect(store.loaded()).toBe(true);
    expect(store.profile()).toBeNull();
    expect(context.revision()).toBe('8');
  });

  it('does not adopt a late response from a previous identity', () => {
    const response = new Subject<NutritionProfileDto>();
    getNutritionProfile.mockReturnValue(response);
    const values: NutritionProfileDto[] = [];
    facade.load().subscribe(value => values.push(value));
    context.reset();
    store.reset();

    response.next({ revision: '8', profile: profileValue() });
    expect(values).toEqual([]);
    expect(store.profile()).toBeNull();
  });

  it('submits the complete profile through the shared coordinator with reviewed revision', () => {
    const operations: MealPlanMutationOperation[] = [];
    enqueue.mockImplementation((candidate: MealPlanMutationOperation) => {
      operations.push(candidate);
      return of({
        operationId: 1,
        kind: 'updateNutritionProfile',
        outcome: 'confirmed',
        revision: '9',
      });
    });
    updateNutritionProfile.mockReturnValue(of({ revision: '9', profile: profileValue() }));
    const request: NutritionProfileRequest = { ...profileValue(), adultConfirmed: true };

    facade.update(request, '8').subscribe();
    const operation = operations[0]!;
    expect(operation.context).toEqual({ kind: 'updateNutritionProfile', expectedRevision: '8' });
    operation.execute('8').subscribe();
    expect(updateNutritionProfile).toHaveBeenCalledWith(request, '8');
  });

  function profileValue() {
    return {
      calculationSex: 'female' as const,
      birthYear: 1990,
      heightCm: 168.5,
      weightKg: 64.25,
    };
  }

  it('returns ProblemDetails field errors and trace without bypassing coordinator classification', async () => {
    updateNutritionProfile.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400,
      error: { traceId: 'test-trace', errors: { birthYear: ['Review age.'], invalid: 42 } } })));
    enqueue.mockImplementation((operation: MealPlanMutationOperation) => {
      operation.execute('8').subscribe({ error: () => undefined });
      return of({ operationId: 1, kind: 'updateNutritionProfile', outcome: 'failed', revision: null });
    });
    const result = await firstValueFrom(facade.update(profileValue(), '8'));
    expect(result.outcome).toBe('failed');
    expect(result.traceId).toBe('test-trace');
    expect(result.errors).toEqual({ birthYear: ['Review age.'] });
    expect(store.profile()).toBeNull();
  });

  it('releases a pause only after review of a fresh current profile with no active write', async () => {
    getNutritionProfile.mockReturnValue(of({ revision: '8', profile: profileValue() }));
    await firstValueFrom(facade.load());
    expect(facade.resumeAfterReview('7')).toBe(false);
    coordinatorState.mockReturnValue({ activeOperationId: 1 });
    expect(facade.resumeAfterReview('8')).toBe(false);
    coordinatorState.mockReturnValue({ activeOperationId: null });
    expect(facade.resumeAfterReview('8')).toBe(true);
    expect(clearPauseAfterReconciliation).toHaveBeenCalledTimes(1);
    store.invalidate();
    expect(facade.resumeAfterReview('8')).toBe(false);
  });
});

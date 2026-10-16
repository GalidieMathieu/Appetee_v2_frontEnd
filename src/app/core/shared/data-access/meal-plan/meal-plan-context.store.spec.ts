import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { MealPlanContextStore } from './meal-plan-context.store';
import { nutritionPlanList } from './testing/meal-plan.fixtures';

describe('MealPlanContextStore', () => {
  let store: MealPlanContextStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(MealPlanContextStore);
    store.reset();
  });

  it('owns confirmed settings and revision for only the current identity generation', () => {
    const generation = store.identityGeneration();
    const response = nutritionPlanList([1]);

    expect(store.replaceConfirmedContext(response.revision, response.settings, generation)).toBe(true);
    expect(store.revision()).toBe('8');
    expect(store.settings()?.currentNutritionPlanId).toBe(1);
    expect(store.replaceConfirmedContext('9', response.settings, generation - 1)).toBe(false);
    expect(store.revision()).toBe('8');
  });

  it('clears identity values, advances generation and epoch, and emits reset$', async () => {
    const generation = store.identityGeneration();
    const epoch = store.readEpoch();
    const resetGeneration = firstValueFrom(store.reset$);

    store.reset();

    await expect(resetGeneration).resolves.toBe(generation + 1);
    expect(store.identityGeneration()).toBe(generation + 1);
    expect(store.readEpoch()).toBe(epoch + 1);
    expect(store.revision()).toBeNull();
    expect(store.settings()).toBeNull();
    expect(store.isGenerationCurrent(generation)).toBe(false);
  });

  it('advances the read epoch without changing confirmed context', () => {
    const response = nutritionPlanList([1]);
    store.replaceConfirmedContext(response.revision, response.settings, store.identityGeneration());

    const nextEpoch = store.advanceReadEpoch();

    expect(nextEpoch).toBe(store.readEpoch());
    expect(store.revision()).toBe('8');
  });
});


import { TestBed } from '@angular/core/testing';

import { NutritionPlansStore } from './nutrition-plans.store';
import { nutritionPlanList } from './testing/meal-plan.fixtures';

describe('NutritionPlansStore', () => {
  let store: NutritionPlansStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(NutritionPlansStore);
    store.reset();
  });

  it('distinguishes not loaded from a successful empty list', () => {
    expect(store.loaded()).toBe(false);
    expect(store.plans()).toEqual([]);

    const token = store.beginLoad(0)!;
    expect(store.acceptList(token, nutritionPlanList([]), 0)).toBe(true);
    expect(store.loaded()).toBe(true);
    expect(store.plans()).toEqual([]);
  });

  it('keeps confirmed summaries on refresh failure and rejects invalidated results', () => {
    const first = store.beginLoad(0)!;
    store.acceptList(first, nutritionPlanList([1, 2]), 0);
    store.invalidate();

    const refresh = store.beginLoad(0)!;
    expect(store.failLoad(refresh, 'Refresh failed', 0)).toBe(true);
    expect(store.plans().map(plan => plan.id)).toEqual([1, 2]);
    expect(store.stale()).toBe(true);

    const obsolete = store.beginLoad(0)!;
    store.invalidate();
    expect(store.acceptList(obsolete, nutritionPlanList([3]), 0)).toBe(false);
    expect(store.plans().map(plan => plan.id)).toEqual([1, 2]);
  });

  it('clears summaries and rejects an old-generation token on reset', () => {
    const token = store.beginLoad(0)!;
    store.reset();

    expect(store.acceptList(token, nutritionPlanList([1]), 0)).toBe(false);
    expect(store.loaded()).toBe(false);
    expect(store.plans()).toEqual([]);
  });
});


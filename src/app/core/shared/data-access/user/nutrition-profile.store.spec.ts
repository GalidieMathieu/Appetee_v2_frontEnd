import { TestBed } from '@angular/core/testing';

import { NutritionProfileStore } from './nutrition-profile.store';
import { nutritionProfile } from '../meal-plan/testing/meal-plan.fixtures';

describe('NutritionProfileStore', () => {
  let store: NutritionProfileStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(NutritionProfileStore);
    store.reset();
  });

  it('distinguishes not loaded from a confirmed absent profile', () => {
    expect(store.loaded()).toBe(false);
    expect(store.profile()).toBeNull();

    const token = store.beginLoad(0)!;
    expect(store.acceptProfile(token, nutritionProfile(false), 0)).toBe(true);
    expect(store.loaded()).toBe(true);
    expect(store.profile()).toBeNull();
    expect(store.request().status).toBe('success');
  });

  it('preserves a stale confirmed profile on refresh failure', () => {
    const initial = store.beginLoad(0)!;
    store.acceptProfile(initial, nutritionProfile(true), 0);
    store.invalidate();

    const refresh = store.beginLoad(0)!;
    store.failLoad(refresh, 'Refresh failed', 0);

    expect(store.profile()?.birthYear).toBe(1990);
    expect(store.stale()).toBe(true);
    expect(store.request().status).toBe('error');
  });

  it('clears identity data and rejects a late response after reset', () => {
    const token = store.beginLoad(0)!;
    const generation = store.identityGeneration();
    store.reset();

    expect(store.identityGeneration()).toBe(generation + 1);
    expect(store.acceptProfile(token, nutritionProfile(true), 0)).toBe(false);
    expect(store.loaded()).toBe(false);
    expect(store.profile()).toBeNull();
    expect(store.revision()).toBeNull();
  });
});


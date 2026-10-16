import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { RecipesApi } from '../recipe.api';
import { RecipesFacade } from '../recipe.facade';
import { RecipesStore } from '../recipes.store';
import { MealPlanContextStore } from '../../meal-plan/meal-plan-context.store';
import { RecipePickerStore } from './recipe-picker.store';
import { RecipePickerFacade } from './recipe-picker.facade';
describe('Scoped recipe picker query', () => {
  const discoverForMealPlan = vi.fn(), favorites = new Subject<void>(), invalidated = new Subject<void>();
  beforeEach(() => {
    discoverForMealPlan.mockReset().mockReturnValue(of({ items: [], nextCursor: null, hasMore: false }));
    TestBed.configureTestingModule({ providers: [RecipePickerFacade, RecipePickerStore,
      { provide: RecipesApi, useValue: { discoverForMealPlan } },
      { provide: RecipesFacade, useValue: { favoriteChanged$: favorites, queryInvalidated$: invalidated } }] });
  });
  it('normalizes independent criteria without changing the main Recipes query', () => {
    const main = TestBed.inject(RecipesStore), before = main.state();
    const picker = TestBed.inject(RecipePickerFacade); picker.apply('  chicken  bowl  ', true);
    expect(discoverForMealPlan.mock.calls[0]?.[0]).toMatchObject({ search: 'chicken bowl', savedOnly: true });
    expect(main.state()).toEqual(before); expect(picker.loaded()).toBe(true);
  });
  it('cancels obsolete pages and drops logout responses', () => {
    const old = new Subject<any>(); discoverForMealPlan.mockReturnValueOnce(old);
    const picker = TestBed.inject(RecipePickerFacade); picker.apply('old', false); picker.apply('new', false);
    old.next({ items: [], nextCursor: 'old', hasMore: true }); expect(picker.hasMore()).toBe(false);
    const response = new Subject<any>(); discoverForMealPlan.mockReturnValue(response); picker.apply('pending', false);
    TestBed.inject(MealPlanContextStore).reset(); response.next({ items: [], nextCursor: 'late', hasMore: true });
    expect(picker.loaded()).toBe(false); expect(picker.cards()).toEqual([]);
  });
  it('favorite events reload Saved but never change the Meal Plan revision', () => {
    const picker = TestBed.inject(RecipePickerFacade), context = TestBed.inject(MealPlanContextStore);
    picker.apply('', true); const revision = context.revision(); favorites.next();
    expect(discoverForMealPlan).toHaveBeenCalledTimes(2); expect(context.revision()).toBe(revision);
  });
});

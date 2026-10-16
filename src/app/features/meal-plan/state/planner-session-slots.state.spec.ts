import { TestBed } from '@angular/core/testing';
import { MealPlanContextStore } from '@app/core/shared/data-access/meal-plan/meal-plan-context.store';
import { plannerRange } from '@app/core/shared/data-access/meal-plan/testing/meal-plan.fixtures';
import { PlannerSessionSlotsState } from './planner-session-slots.state';

describe('PlannerSessionSlotsState', () => {
  const saved = plannerRange('2026-10-12').days[0]!;
  const untouched = { ...saved, id: null, persistence: 'untouched' as const, savedMealCount: 0,
    meals: [1, 2, 3].map(slot => ({ ...saved.meals[0]!, id: null, key: 'virtual:' + saved.date + ':' + slot,
      name: ['Breakfast', 'Lunch', 'Dinner'][slot - 1]!, isVirtual: true, defaultSlot: slot, sortOrder: slot, items: [] })) };

  it('retains only observed, unused suggestions without changing confirmed counts or totals', () => {
    const state = TestBed.inject(PlannerSessionSlotsState);
    state.remember(untouched); state.consume(saved.date, 1, 20);
    const projected = state.project(saved);
    expect(projected.meals.map(meal => meal.name)).toEqual(['Lunch', 'Lunch', 'Dinner']);
    expect(projected.savedMealCount).toBe(saved.savedMealCount);
    expect(projected.totals).toBe(saved.totals);
    expect(saved.meals).toHaveLength(1);
  });

  it('never invents defaults for a saved day or resurrects a consumed slot after deletion', () => {
    const state = TestBed.inject(PlannerSessionSlotsState);
    expect(state.project(saved)).toBe(saved);
    state.remember(untouched); state.consume(saved.date, 2, 77);
    expect(state.project({ ...saved, savedMealCount: 0, meals: [] }).meals.map(meal => meal.defaultSlot)).toEqual([1, 3]);
    expect(state.alias(saved.date, 2)).toBe(77);
  });

  it('clears suggestions and aliases on logout/identity reset, even without a mounted workspace', () => {
    const state = TestBed.inject(PlannerSessionSlotsState);
    state.remember(untouched); state.consume(saved.date, 1, 77);
    TestBed.inject(MealPlanContextStore).reset();
    expect(state.project(saved)).toBe(saved);
    expect(state.alias(saved.date, 1)).toBeNull();
  });

  it('drops destination suggestions after a confirmed copy without affecting another date', () => {
    const state = TestBed.inject(PlannerSessionSlotsState);
    state.remember(untouched); state.remember({ ...untouched, date: '2026-10-13' });
    state.forget([saved.date]);
    expect(state.project(saved)).toBe(saved);
    expect(state.project({ ...saved, date: '2026-10-13' }).meals).toHaveLength(4);
  });
});

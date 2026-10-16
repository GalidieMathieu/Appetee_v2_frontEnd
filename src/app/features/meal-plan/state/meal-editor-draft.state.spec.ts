import { MealEditorDraftState, validMealName, validRecipeQuantity } from './meal-editor-draft.state';
import { plannerRange } from '@app/core/shared/data-access/meal-plan/testing/meal-plan.fixtures';
describe('Meal editor scalar drafts', () => {
  it('never edits the confirmed DTO and preserves name 4 when name 2 is acknowledged', () => {
    const state = new MealEditorDraftState(), meal = plannerRange('2026-10-12').days[0]!.meals[0]!;
    state.bind(meal, '8'); state.setName('Name 2'); const version = state.nameVersion();
    state.setName('Name 4'); state.ackName(version, 'Name 2', '9');
    expect(state.name()).toBe('Name 4'); expect(state.dirty()).toBe(true); expect(meal.name).toBe('Lunch');
    expect(state.viewStatus()).not.toBe('saved');
  });
  it('quantity 4 survives acknowledgement of 2 without changing confirmed nutrition', () => {
    const state = new MealEditorDraftState(), meal = plannerRange('2026-10-12').days[0]!.meals[0]!;
    state.bind(meal, '8'); state.setQuantity(30, 2); const version = state.quantities()[30]!.version;
    state.setQuantity(30, 4); state.ackQuantity(30, version, 2, '9');
    expect(state.quantities()[30]!.value).toBe(4); expect(meal.items[0]?.nutrition.caloriesKcal).toBe(500);
    expect(state.dirty()).toBe(true);
  });
  it('rejects fractional/zero/blank quantities and control/overlong names without clamping', () => {
    for (const value of ['', 0, 21, 1.5, 'NaN']) expect(validRecipeQuantity(value)).toBe(false);
    for (const value of ['', 'a\nb', 'x'.repeat(81)]) expect(validMealName(value)).toBe(false);
    expect(validMealName('  Lunch  ')).toBe(true); expect(validRecipeQuantity(20)).toBe(true);
  });
  it('external revision change preserves a draft and requires explicit review', () => {
    const state = new MealEditorDraftState(), meal = plannerRange('2026-10-12').days[0]!.meals[0]!;
    state.bind(meal, '8'); state.setName('My draft'); state.bind({ ...meal, name: 'Another device' }, '10');
    expect(state.name()).toBe('My draft'); expect(state.revision()).toBe('8'); expect(state.blocked()).toBe(true);
    state.reviewed('10', { ...meal, name: 'Another device' }); expect(state.name()).toBe('My draft'); expect(state.revision()).toBe('10');
  });
});

import { MealPlanOrderingState, movedIds } from './meal-plan-ordering.state';
describe('Temporary ordering IDs', () => {
  it('uses the same complete permutation for drop and keyboard movement without mutating confirmed IDs', () => {
    const source = Object.freeze([20, 21, 22]);
    expect(movedIds(source, 0, 1)).toEqual([21, 20, 22]); expect(source).toEqual([20, 21, 22]);
    expect(movedIds(source, 2, 0)).toEqual([22, 20, 21]);
  });
  it.each([[[], 0, 1], [[1, 1], 0, 1], [[0, 2], 0, 1], [[1, 2], -1, 1], [[1, 2], 0, 2], [[1, 2], 0, 0]] as const)('rejects invalid/unchanged permutation %j', (ids, from, to) => { expect(movedIds(ids, from, to)).toBeNull(); });
  it('clears failed overlays and announces one result with the same moved identity for focus', () => {
    const state = new MealPlanOrderingState(); state.ids.set([2, 1]); state.parent.set('meal:20'); state.settled('item', 1, 0, 2, false);
    expect(state.ids()).toBeNull(); expect(state.focus()?.id).toBe(1); expect(state.announcement()).toContain('confirmed order');
    state.reset(); expect(state.focus()).toBeNull(); expect(state.announcement()).toBe('');
  });
});

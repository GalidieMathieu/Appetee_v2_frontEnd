import { mealPlanPendingChangesGuard } from './meal-plan-pending-changes.guard';
import { vi } from 'vitest';
describe('Planner pending changes guard', () => {
  it('delegates query/task and browser navigation without issuing HTTP', async () => {
    const canLeave = vi.fn().mockResolvedValue(false), url = '/meal-plan/planner?date=2026-10-12&task=day';
    expect(await (mealPlanPendingChangesGuard as any)({ vm: { canLeave } }, {}, {}, { url })).toBe(false);
    expect(canLeave).toHaveBeenCalledWith(url);
  });
});

import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { NutritionPlanFlowFacade } from '../state/nutrition-plan-flow.facade';
import { nutritionPlanPendingChangesGuard } from './nutrition-plan-pending-changes.guard';

describe('nutritionPlanPendingChangesGuard', () => {
  it.each([true, false])('delegates leave decision (%s) to the feature flow without writing', allowed => {
    const canLeave = vi.fn(() => allowed);
    TestBed.configureTestingModule({ providers: [{ provide: NutritionPlanFlowFacade, useValue: { canLeave } }] });
    expect(TestBed.runInInjectionContext(() => nutritionPlanPendingChangesGuard({} as never, {} as never, {} as never, {} as never))).toBe(allowed);
    expect(canLeave).toHaveBeenCalledOnce();
  });
});

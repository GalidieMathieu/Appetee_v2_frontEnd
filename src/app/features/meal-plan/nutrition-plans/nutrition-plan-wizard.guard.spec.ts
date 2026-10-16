import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, convertToParamMap, provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { NutritionPlanFlowFacade } from '../state/nutrition-plan-flow.facade';
import { nutritionPlanWizardGuard } from './nutrition-plan-wizard.guard';
describe('nutritionPlanWizardGuard', () => {
    const startWizard = vi.fn(), canVisit = vi.fn();
    beforeEach(() => { startWizard.mockReset(); canVisit.mockReset(); TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: NutritionPlanFlowFacade, useValue: { startWizard, canVisit, draftState: { firstIncomplete: () => 'profile' } } }] }); });
    it.each(['unknown', 'review'])('redirects invalid or incomplete direct entry %s to profile', step => { canVisit.mockReturnValue(false); const result = TestBed.runInInjectionContext(() => nutritionPlanWizardGuard({ paramMap: convertToParamMap({ step }) } as ActivatedRouteSnapshot, {} as RouterStateSnapshot)); expect(TestBed.inject(Router).serializeUrl(result as any)).toBe('/meal-plan/nutrition-plans/create/intermediate/profile'); expect(startWizard).toHaveBeenCalledTimes(1); });
    it('allows a validated named step', () => { canVisit.mockReturnValue(true); expect(TestBed.runInInjectionContext(() => nutritionPlanWizardGuard({ paramMap: convertToParamMap({ step: 'activity' }) } as ActivatedRouteSnapshot, {} as RouterStateSnapshot))).toBe(true); });
});

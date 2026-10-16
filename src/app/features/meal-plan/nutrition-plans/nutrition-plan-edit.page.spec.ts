import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { By } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MEAL_PLAN_ROUTES } from '../meal-plan.routes';
import { NutritionPlanEditPage } from './nutrition-plan-edit.page';
import { NutritionPlanApi } from '@app/core/shared/data-access/meal-plan/nutrition-plan.api';
import { NutritionProfileFacade } from '@app/core/shared/data-access/user/nutrition-profile.facade';
import { nutritionPlanDetail, nutritionProfile } from '@app/core/shared/data-access/meal-plan/testing/meal-plan.fixtures';
describe('NutritionPlanEditPage', () => {
    const getPlan = vi.fn(), previewCalculation = vi.fn(), updatePlan = vi.fn();
    beforeEach(() => { getPlan.mockReset().mockReturnValue(of(nutritionPlanDetail())); previewCalculation.mockReset(); updatePlan.mockReset(); TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'meal-plan', children: MEAL_PLAN_ROUTES }]), { provide: NutritionPlanApi, useValue: { getPlan, previewCalculation, updatePlan } }, { provide: NutritionProfileFacade, useValue: { load: () => of(nutritionProfile()), store: { profile: () => nutritionProfile().profile } } }] }); });
    it('uses complete detail, renders one page with no mode selector and never calculates on entry', async () => { const harness = await RouterTestingHarness.create('/meal-plan/nutrition-plans/1/edit'); expect(getPlan).toHaveBeenCalledWith(1); expect(harness.routeNativeElement?.querySelectorAll('#edit-name')).toHaveLength(1); expect(harness.routeNativeElement?.querySelector('[formControlName="mode"]')).toBeNull(); expect(harness.routeNativeElement?.textContent).toContain('Saved estimates'); expect(previewCalculation).not.toHaveBeenCalled(); expect(updatePlan).not.toHaveBeenCalled(); });
    it('foreign or missing detail renders the same safe unavailable page', async () => { getPlan.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 }))); const harness = await RouterTestingHarness.create('/meal-plan/nutrition-plans/99/edit'); expect(harness.routeNativeElement?.textContent).toContain('This plan is unavailable.'); expect(harness.routeNativeElement?.querySelector('#edit-name')).toBeNull(); expect(updatePlan).not.toHaveBeenCalled(); });
    it('preserves dirty fields and focused feedback after update failure', async () => { const harness = await RouterTestingHarness.create('/meal-plan/nutrition-plans/1/edit'); const page = harness.routeDebugElement!.query(By.directive(NutritionPlanEditPage)).componentInstance as NutritionPlanEditPage; page.vm.form.controls.name.setValue('Unsaved'); updatePlan.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { code: 'validation_error', errors: { name: ['Review name.'] } } }))); page.vm.create(); harness.detectChanges(); expect(page.vm.form.controls.name.value).toBe('Unsaved'); expect(TestBed.inject(Router).url).toContain('/1/edit'); expect(updatePlan).toHaveBeenCalledTimes(1); expect(updatePlan.mock.calls[0]?.[1]).toEqual({ name: 'Unsaved', defaultMealsPerDay: 4 }); expect(harness.routeNativeElement?.textContent).toContain('Review name.'); expect(document.activeElement?.getAttribute('role')).toBe('alert'); });
});

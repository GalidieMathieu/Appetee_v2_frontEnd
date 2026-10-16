import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { NutritionPlanFacade } from '@app/core/shared/data-access/meal-plan/nutrition-plan.facade';
import { NutritionProfileFacade } from '@app/core/shared/data-access/user/nutrition-profile.facade';
import { NutritionPlanFlowFacade } from './nutrition-plan-flow.facade';
import { NutritionPlanDraftState } from './nutrition-plan-draft.state';
import { NutritionCalculationDto, NutritionPlanDetailDto } from '@app/core/shared/data-access/meal-plan/nutrition-plan.model';
import { nutritionPlan, nutritionPlanDetail, nutritionPlanList, nutritionProfile, KNOWN_NUTRIENTS } from '@app/core/shared/data-access/meal-plan/testing/meal-plan.fixtures';
const previewValue: NutritionCalculationDto = { policyVersion: '2026.2', calculationYear: 2026, inputs: nutritionPlan().calculationInputs!, rmrKcal: 1400, maintenanceKcal: 2200, targets: KNOWN_NUTRIENTS, warnings: [] };
describe('Intermediate preview and edit orchestration', () => {
    const preview = vi.fn(), update = vi.fn(), create = vi.fn(), loadDetail = vi.fn(), navigate = vi.fn(), navigateByUrl = vi.fn();
    let flow: NutritionPlanFlowFacade;
    let draft: NutritionPlanDraftState;
    beforeEach(() => {
        for (const mock of [preview, update, create, loadDetail, navigate, navigateByUrl])
            mock.mockReset();
        TestBed.configureTestingModule({ providers: [NutritionPlanDraftState, NutritionPlanFlowFacade,
                { provide: NutritionProfileFacade, useValue: { load: () => of(nutritionProfile()), store: { profile: () => nutritionProfile().profile } } },
                { provide: NutritionPlanFacade, useValue: { preview, update, create, loadDetail, loadList: () => of(nutritionPlanList()), plans: signal(nutritionPlanList().plans), revision: signal('8'), settings: signal(nutritionPlanList().settings), request: signal({ status: 'success', error: null }), canWrite: signal(true), paused: signal(false), pending: signal(null), detail: () => nutritionPlanDetail(), detailFresh: () => true, detailRequest: () => ({ status: 'success', error: null }) } },
                { provide: Router, useValue: { navigate, navigateByUrl } }] });
        flow = TestBed.inject(NutritionPlanFlowFacade);
        draft = TestBed.inject(NutritionPlanDraftState);
    });
    afterEach(() => { vi.useRealTimers(); });
    it('debounces preview, cancels obsolete calculation results and keeps metadata edits independent', async () => { vi.useFakeTimers(); const old = new Subject<NutritionCalculationDto>(); const current = new Subject<NutritionCalculationDto>(); preview.mockReturnValueOnce(old).mockReturnValueOnce(current); flow.startWizard(); draft.choices.setValue({ goal: 'maintain', activityLevel: 'active' }); await vi.advanceTimersByTimeAsync(299); expect(preview).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(1); expect(preview).toHaveBeenCalledTimes(1); draft.choices.controls.goal.setValue('fatLoss'); old.next(previewValue); expect(draft.preview()).toBeNull(); await vi.advanceTimersByTimeAsync(300); current.next({ ...previewValue, policyVersion: 'current' }); expect(draft.preview()?.policyVersion).toBe('current'); draft.form.controls.name.setValue('Changed name'); await vi.advanceTimersByTimeAsync(300); expect(preview).toHaveBeenCalledTimes(2); });
    it('cancels a pending preview when the flow exits', async () => { vi.useFakeTimers(); const response = new Subject<NutritionCalculationDto>(); preview.mockReturnValue(response); flow.startWizard(); draft.choices.setValue({ goal: 'maintain', activityLevel: 'active' }); await vi.advanceTimersByTimeAsync(300); flow.leave(); response.next(previewValue); expect(draft.preview()).toBeNull(); expect(draft.dirty()).toBe(false); });
    it('does not recalculate on opening edit and sends metadata only with the original revision', () => { loadDetail.mockReturnValue(of(nutritionPlanDetail())); flow.startEdit(1); expect(preview).not.toHaveBeenCalled(); draft.form.controls.name.setValue('Renamed'); update.mockReturnValue(of({ outcome: 'confirmed', revision: '9' })); flow.create(); expect(update).toHaveBeenCalledWith(1, { name: 'Renamed', defaultMealsPerDay: 4 }, '8'); expect(create).not.toHaveBeenCalled(); expect(navigateByUrl).toHaveBeenCalled(); });
    it('keeps newer edited profile/name values when a refreshed detail arrives', () => { const first = new Subject<NutritionPlanDetailDto>(); loadDetail.mockReturnValueOnce(of(nutritionPlanDetail())).mockReturnValueOnce(first); flow.startEdit(1); draft.form.controls.name.setValue('Unsaved'); draft.profileForm.controls.weightKg.setValue(80); flow.refresh(); first.next({ ...nutritionPlanDetail(), revision: '9', plan: { ...nutritionPlan(), name: 'Server' } }); expect(draft.form.controls.name.value).toBe('Unsaved'); expect(draft.profileForm.controls.weightKg.value).toBe(80); expect(draft.reviewedRevision()).toBe('8'); expect(flow.requiresReview()).toBe(true); });
    it('preserves edit fields after confirmed CSRF rejection without replay or revision substitution', () => { loadDetail.mockReturnValue(of(nutritionPlanDetail())); flow.startEdit(1); draft.form.controls.name.setValue('Private draft'); update.mockReturnValue(of({ outcome: 'failed', code: 'csrf_invalid' })); flow.create(); expect(update).toHaveBeenCalledTimes(1); expect(draft.form.controls.name.value).toBe('Private draft'); expect(draft.reviewedRevision()).toBe('8'); expect(navigateByUrl).not.toHaveBeenCalled(); expect(flow.error()).toContain('security'); });
    it('uses current profile only after explicit intent and invalidates the prior preview', () => {
        loadDetail.mockReturnValue(of(nutritionPlanDetail())); flow.startEdit(1);
        draft.profileForm.controls.weightKg.setValue(80); draft.preview.set(previewValue);
        flow.useCurrentProfile();
        expect(draft.profileForm.controls.weightKg.value).toBe(nutritionProfile().profile!.weightKg);
        expect(draft.preview()).toBeNull(); expect(draft.dirty()).toBe(false);
        expect(update).not.toHaveBeenCalled();
    });
    it('policy-stale rejection preserves the draft and fetches a new preview only after controls are reenabled', async () => {
        vi.useFakeTimers(); flow.startWizard(); draft.choices.setValue({ goal: 'maintain', activityLevel: 'active' });
        draft.form.setValue({ name: 'Training', defaultMealsPerDay: 4 }); draft.preview.set(previewValue);
        preview.mockReturnValue(of({ ...previewValue, policyVersion: 'new-policy' }));
        create.mockReturnValue(of({ outcome: 'conflict', code: 'calculation_preview_stale' })); flow.create();
        expect(draft.form.controls.name.value).toBe('Training'); expect(draft.preview()).toBeNull();
        await vi.advanceTimersByTimeAsync(300);
        expect(draft.preview()?.policyVersion).toBe('new-policy'); expect(create).toHaveBeenCalledTimes(1);
        expect(draft.reviewedRevision()).toBe('8'); expect(flow.requiresReview()).toBe(true);
    });
});

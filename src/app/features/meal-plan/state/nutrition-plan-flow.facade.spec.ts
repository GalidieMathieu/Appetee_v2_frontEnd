import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { MealPlanContextStore } from '@app/core/shared/data-access/meal-plan/meal-plan-context.store';
import { NutritionPlanFacade, NutritionPlanOperationResult } from '@app/core/shared/data-access/meal-plan/nutrition-plan.facade';
import { nutritionPlanList } from '@app/core/shared/data-access/meal-plan/testing/meal-plan.fixtures';
import { NutritionPlanDraftState } from './nutrition-plan-draft.state';
import { NutritionPlanFlowFacade } from './nutrition-plan-flow.facade';
describe('NutritionPlanFlowFacade Easy creation', () => {
    const loadList = vi.fn();
    const create = vi.fn();
    const resumeAfterReview = vi.fn();
    const navigateByUrl = vi.fn();
    const confirm = vi.fn();
    const plans = signal(nutritionPlanList().plans);
    const revision = signal('8');
    let flow: NutritionPlanFlowFacade;
    beforeEach(() => {
        for (const mock of [loadList, create, resumeAfterReview, navigateByUrl, confirm])
            mock.mockReset();
        plans.set(nutritionPlanList().plans);
        revision.set('8');
        loadList.mockImplementation(() => of({ ...nutritionPlanList(), revision: revision() }));
        resumeAfterReview.mockReturnValue(true);
        navigateByUrl.mockResolvedValue(true);
        TestBed.configureTestingModule({ providers: [NutritionPlanDraftState, NutritionPlanFlowFacade,
                { provide: NutritionPlanFacade, useValue: {
                        loadList, create, resumeAfterReview, plans, revision, settings: signal(nutritionPlanList().settings),
                        request: signal({ status: 'success', error: null }), canWrite: signal(true), paused: signal(false),
                    } }, { provide: Router, useValue: { navigateByUrl } },
            ] });
        vi.spyOn(TestBed.inject(DOCUMENT).defaultView!, 'confirm').mockImplementation(confirm);
        flow = TestBed.inject(NutritionPlanFlowFacade);
        flow.enter();
        flow.form.setValue({ name: 'My Easy plan', defaultMealsPerDay: 3 });
    });
    afterEach(() => vi.restoreAllMocks());
    it('sends only Easy fields, blocks double submission and navigates only after acknowledgment', () => {
        const response = new Subject<NutritionPlanOperationResult>();
        create.mockReturnValue(response);
        flow.create();
        flow.create();
        expect(create).toHaveBeenCalledTimes(1);
        expect(create).toHaveBeenCalledWith({ name: 'My Easy plan', mode: 'easy', defaultMealsPerDay: 3 }, '8');
        expect(navigateByUrl).not.toHaveBeenCalled();
        expect(flow.form.disabled).toBe(true);
        response.next({ operationId: 1, kind: 'createNutritionPlan', outcome: 'confirmed', revision: '9' });
        expect(flow.dirty()).toBe(false);
        expect(flow.canLeave()).toBe(true);
        expect(navigateByUrl).toHaveBeenCalledWith('/meal-plan/nutrition-plans', { replaceUrl: true, state: { focusCreatePlan: true } });
    });
    it('preserves Unicode name/count and maps the server name collision without renaming', () => {
        flow.form.controls.name.setValue('Café');
        create.mockReturnValue(of({ outcome: 'conflict', revision: null, code: 'plan_name_conflict', traceId: 'test-trace' }));
        flow.create();
        flow.create();
        expect(flow.form.controls.name.value).toBe('Café');
        expect(flow.fieldErrors().name?.[0]).toContain('case and accents');
        expect(flow.diagnostic()).toContain('test-trace');
        expect(create).toHaveBeenCalledTimes(1);
        expect(navigateByUrl).not.toHaveBeenCalled();
    });
    it.each(['conflict', 'unknownOutcome'])('requires explicit refresh and review for %s, never replaying create', outcome => {
        create.mockReturnValue(of({ outcome, revision: null }));
        flow.create();
        revision.set('9');
        flow.refresh();
        expect(TestBed.inject(NutritionPlanDraftState).reviewedRevision()).toBe('8');
        expect(resumeAfterReview).not.toHaveBeenCalled();
        expect(flow.canLeave()).toBe(false);
        flow.confirmReview();
        expect(TestBed.inject(NutritionPlanDraftState).reviewedRevision()).toBe('9');
        expect(create).toHaveBeenCalledTimes(1);
        flow.create();
        expect(create.mock.calls[1]?.[1]).toBe('9');
    });
    it('renders field validation failures without losing the draft or navigating', () => {
        create.mockReturnValue(of({ outcome: 'failed', revision: null, errors: { name: ['Review the name.'], defaultMealsPerDay: ['Review count.'] } }));
        flow.create();
        expect(flow.form.controls.defaultMealsPerDay.value).toBe(3);
        expect(flow.fieldErrors().defaultMealsPerDay).toEqual(['Review count.']);
        expect(flow.form.enabled).toBe(true);
        expect(navigateByUrl).not.toHaveBeenCalled();
    });
    it('guards dirty cancellation, blocks pending discard and does not create on Cancel', () => {
        confirm.mockReturnValue(false);
        expect(flow.canLeave()).toBe(false);
        confirm.mockReturnValue(true);
        expect(flow.canLeave()).toBe(true);
        expect(flow.dirty()).toBe(false);
        flow.cancel();
        expect(create).not.toHaveBeenCalled();
    });
    it('does not send invalid or cap-exceeding intent', () => {
        flow.form.controls.name.setValue('');
        flow.create();
        expect(create).not.toHaveBeenCalled();
        flow.form.controls.name.setValue('Valid');
        plans.set(nutritionPlanList(Array.from({ length: 50 }, (_, i) => i + 1)).plans);
        flow.create();
        expect(create).not.toHaveBeenCalled();
        expect(flow.error()).toContain('50');
    });
    it('ignores a late old-session result and clears the route draft', () => {
        const response = new Subject<NutritionPlanOperationResult>();
        create.mockReturnValue(response);
        flow.create();
        expect(flow.canLeave()).toBe(false);
        TestBed.inject(MealPlanContextStore).reset();
        response.next({ operationId: 1, kind: 'createNutritionPlan', outcome: 'confirmed', revision: '9' });
        expect(navigateByUrl).not.toHaveBeenCalled();
        expect(flow.dirty()).toBe(false);
        expect(flow.form.controls.name.value).toBe('');
    });
    it('does not clear or label newer changes saved after an older acknowledgment', () => {
        const response = new Subject<NutritionPlanOperationResult>();
        create.mockReturnValue(response);
        flow.create();
        flow.form.controls.name.setValue('Newer draft');
        response.next({ operationId: 1, kind: 'createNutritionPlan', outcome: 'confirmed', revision: '9' });
        expect(flow.form.controls.name.value).toBe('Newer draft');
        expect(flow.dirty()).toBe(true);
        expect(navigateByUrl).not.toHaveBeenCalled();
        flow.create();
        expect(create).toHaveBeenCalledTimes(1);
    });
});

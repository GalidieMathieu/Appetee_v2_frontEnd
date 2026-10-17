import { TestBed } from '@angular/core/testing';
import { NutritionPlanDraftState } from './nutrition-plan-draft.state';
import { NutritionPlanStep } from '../models/nutrition-plan-draft.model';
import { nutritionPlan, nutritionProfile, KNOWN_NUTRIENTS } from '@app/core/shared/data-access/meal-plan/testing/meal-plan.fixtures';
import { NutritionCalculationDto } from '@app/core/shared/data-access/meal-plan/nutrition-plan.model';
import { MealPlanContextStore } from '@app/core/shared/data-access/meal-plan/meal-plan-context.store';
export function calculationPreview(): NutritionCalculationDto { return { policyVersion: '2026.2', calculationYear: 2026, inputs: nutritionPlan().calculationInputs!, rmrKcal: 1400, maintenanceKcal: 2200, targets: KNOWN_NUTRIENTS, warnings: [] }; }
describe('Intermediate plan and edit drafts', () => {
    let draft: NutritionPlanDraftState;
    beforeEach(() => { TestBed.configureTestingModule({ providers: [NutritionPlanDraftState] }); draft = TestBed.inject(NutritionPlanDraftState); });
    it('rejects unknown strings, null and native events as runtime steps', () => {
        for (const step of ['unknown', '', null, new Event('change')]) {
            expect(draft.canVisit(step as NutritionPlanStep)).toBe(false);
        }
    });
    it('blocks direct review until profile, goal, activity and structure are valid', () => { draft.mode.set('intermediate'); expect(draft.canVisit('review')).toBe(false); draft.seedProfile(nutritionProfile().profile); expect(draft.firstIncomplete()).toBe('goal'); draft.choices.setValue({ goal: 'maintain', activityLevel: 'active' }); expect(draft.firstIncomplete()).toBe('meal-structure'); draft.form.controls.defaultMealsPerDay.setValue(4); expect(draft.canVisit('review')).toBe(true); });
    it('sends calculation inputs and reviewed evidence, never client targets', () => { draft.mode.set('intermediate'); draft.seedProfile(nutritionProfile().profile); draft.choices.setValue({ goal: 'maintain', activityLevel: 'active' }); draft.form.setValue({ name: 'Training', defaultMealsPerDay: 4 }); expect(draft.createRequest()).toBeNull(); draft.preview.set(calculationPreview()); const request = draft.createRequest()!; expect(request.mode).toBe('intermediate'); expect(request.reviewedPolicyVersion).toBe('2026.2'); expect(request.reviewedCalculationYear).toBe(2026); expect(request).not.toHaveProperty('targets'); });
    it('invalidates previews on calculation changes but not name or meal count changes', () => { draft.seedPlan(nutritionPlan(), '8'); draft.preview.set(calculationPreview()); draft.form.controls.name.setValue('New name'); expect(draft.preview()).not.toBeNull(); draft.choices.controls.goal.setValue('fatLoss'); expect(draft.preview()).toBeNull(); });
    it('metadata-only editing omits all calculation fields and keeps confirmed targets untouched', () => { const plan = nutritionPlan(); draft.seedPlan(plan, '8'); draft.form.setValue({ name: 'Renamed', defaultMealsPerDay: 3 }); expect(draft.updateRequest()).toEqual({ name: 'Renamed', defaultMealsPerDay: 3 }); expect(plan.targets).toBe(KNOWN_NUTRIENTS); expect(draft.mode()).toBe('intermediate'); });
    it('never overwrites an edited draft with a late detail or global profile', () => { draft.seedPlan(nutritionPlan(), '8'); draft.form.controls.name.setValue('Unsaved'); draft.profileForm.controls.weightKg.setValue(80); draft.seedPlan({ ...nutritionPlan(), name: 'Refreshed' }, '9'); draft.seedProfile({ ...nutritionProfile().profile!, weightKg: 90 }); expect(draft.form.controls.name.value).toBe('Unsaved'); expect(draft.profileForm.controls.weightKg.value).toBe(80); expect(draft.reviewedRevision()).toBe('8'); });
    it('explicit recalculation is dirty and requires a current preview before update', () => { draft.seedPlan(nutritionPlan(), '8'); draft.requestRecalculation(); expect(draft.dirty()).toBe(true); expect(draft.updateRequest()).toBeNull(); draft.preview.set(calculationPreview()); expect(draft.updateRequest()?.reviewedPolicyVersion).toBe('2026.2'); });
    it('Easy edits cannot gain calculations', () => { draft.seedPlan({ ...nutritionPlan(), mode: 'easy', calculationInputs: null, goal: null, activityLevel: null, targets: null }, '8'); draft.requestRecalculation(); draft.preview.set(calculationPreview()); expect(draft.updateRequest()).toEqual({ name: 'Plan 1', defaultMealsPerDay: 4 }); });
    it('clears all private draft and preview state on identity reset', () => { draft.seedPlan(nutritionPlan(), '8'); draft.preview.set(calculationPreview()); TestBed.inject(MealPlanContextStore).reset(); expect(draft.preview()).toBeNull(); expect(draft.form.controls.name.value).toBe(''); expect(draft.choices.controls.goal.value).toBeNull(); });
});

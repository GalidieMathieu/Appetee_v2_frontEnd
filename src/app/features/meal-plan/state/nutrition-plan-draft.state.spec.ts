import { TestBed } from '@angular/core/testing';
import { MealPlanContextStore } from '@app/core/shared/data-access/meal-plan/meal-plan-context.store';
import { NutritionPlanDraftState } from './nutrition-plan-draft.state';
describe('NutritionPlanDraftState Easy form', () => {
    let state: NutritionPlanDraftState;
    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [NutritionPlanDraftState] });
        state = TestBed.inject(NutritionPlanDraftState);
    });
    it('starts empty without choosing an arbitrary count and emits only Easy fields', () => {
        expect(state.request()).toBeNull();
        expect(state.dirty()).toBe(false);
        state.form.setValue({ name: '  Café  ', defaultMealsPerDay: 4 });
        expect(state.request()).toEqual({ name: 'Café', mode: 'easy', defaultMealsPerDay: 4 });
        expect(state.dirty()).toBe(true);
    });
    it('validates normalized Unicode scalar length and rejects controls/lone surrogates', () => {
        state.form.controls.defaultMealsPerDay.setValue(1);
        for (const name of ['😀'.repeat(80), 'e\u0301'.repeat(80)]) {
            state.form.controls.name.setValue(name);
            expect(state.form.valid).toBe(true);
        }
        for (const name of ['', '   ', '😀'.repeat(81), 'two\nlines', 'tab\tname', '\ud800', 'line\u2028break']) {
            state.form.controls.name.setValue(name);
            expect(state.form.invalid).toBe(true);
        }
    });
    it('accepts inclusive count bounds and rejects fractional, missing or non-finite values', () => {
        state.form.controls.name.setValue('Plan');
        for (const count of [1, 8]) {
            state.form.controls.defaultMealsPerDay.setValue(count);
            expect(state.form.valid).toBe(true);
        }
        for (const count of [null, 0, 9, 1.5, NaN, Infinity]) {
            state.form.controls.defaultMealsPerDay.setValue(count);
            expect(state.request()).toBeNull();
        }
    });
    it('never overwrites the original review revision or typed fields on late reads', () => {
        state.form.setValue({ name: 'My draft', defaultMealsPerDay: 3 });
        state.initializeRevision('8');
        state.initializeRevision('9');
        expect(state.reviewedRevision()).toBe('8');
        expect(state.form.controls.name.value).toBe('My draft');
        state.reviewRevision('9');
        expect(state.reviewedRevision()).toBe('9');
    });
    it('clears only the acknowledged version, preserving newer unsaved intent', () => {
        state.form.setValue({ name: 'First', defaultMealsPerDay: 3 });
        const version = state.version();
        state.form.controls.name.setValue('Second');
        expect(state.acknowledge(version)).toBe(false);
        expect(state.form.controls.name.value).toBe('Second');
        expect(state.acknowledge(state.version())).toBe(true);
        expect(state.dirty()).toBe(false);
    });
    it('clears and enables draft controls on identity reset', () => {
        state.form.setValue({ name: 'Private draft', defaultMealsPerDay: 3 });
        state.form.disable({ emitEvent: false });
        TestBed.inject(MealPlanContextStore).reset();
        expect(state.form.getRawValue()).toEqual({ name: '', defaultMealsPerDay: null });
        expect(state.form.enabled).toBe(true);
        expect(state.reviewedRevision()).toBeNull();
    });
});

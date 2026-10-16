import { TestBed } from '@angular/core/testing';
import { convertToParamMap } from '@angular/router';
import { MealPlanWorkspaceState, localCalendarDate, calendarDate, shiftCalendarDate } from './meal-plan-workspace.state';
import { MealPlanContextStore } from '@app/core/shared/data-access/meal-plan/meal-plan-context.store';
describe('MealPlanWorkspaceState', () => {
    it('round trips manual Add/Edit and rejects virtual Edit, extra or duplicate item selectors', () => {
        const state = TestBed.inject(MealPlanWorkspaceState);
        expect(state.parse(convertToParamMap({ date: '2026-10-12', task: 'manual', defaultSlot: '2' }))).toBe(false);
        expect(state.task()).toBe('manual'); expect(state.query().defaultSlot).toBe(2);
        expect(state.parse(convertToParamMap({ date: '2026-10-12', task: 'manual', mealId: '20', itemId: '55' }))).toBe(false);
        expect(state.query().itemId).toBe(55);
        for (const query of [{ defaultSlot: '2', itemId: '55' }, { mealId: '20', defaultSlot: '2' }, { mealId: '20', itemId: '0' }, { mealId: '20', itemId: ['55', '56'] }]) {
            expect(state.parse(convertToParamMap({ date: '2026-10-12', task: 'manual', ...query }))).toBe(true);
        }
        expect(state.parse(convertToParamMap({ date: '2026-10-12', task: 'meal', mealId: '20', itemId: '55' }))).toBe(true);
    });
    it('accepts picker with exactly one selector and rejects conflicting or missing selectors', () => {
        const state = TestBed.inject(MealPlanWorkspaceState);
        expect(state.parse(convertToParamMap({ date: '2026-10-12', task: 'recipe-picker', defaultSlot: '2' }))).toBe(false);
        expect(state.task()).toBe('recipe-picker');
        expect(state.parse(convertToParamMap({ date: '2026-10-12', task: 'recipe-picker', mealId: '20', defaultSlot: '2' }))).toBe(true);
        expect(state.task()).toBe('day');
        expect(state.parse(convertToParamMap({ date: '2026-10-12', task: 'recipe-picker' }))).toBe(true);
    });
    let state: MealPlanWorkspaceState;
    beforeEach(() => { TestBed.configureTestingModule({ providers: [MealPlanWorkspaceState] }); state = TestBed.inject(MealPlanWorkspaceState); });
    it.each([['2026-01-01', '2025-12-29', '2026-01-04'], ['2026-03-08', '2026-03-02', '2026-03-08'], ['2026-11-01', '2026-10-26', '2026-11-01']])('uses Monday calendar weeks across year and DST for %s', (date, from, through) => { state.parse(convertToParamMap({ date })); expect(state.week()).toEqual({ from, through }); expect(state.dates()).toHaveLength(7); });
    it('uses local Today without UTC conversion and rejects impossible dates', () => { const date = new Date(2026, 9, 12, 23, 59); expect(localCalendarDate(date)).toBe('2026-10-12'); expect(calendarDate('2026-02-30')).toBeNull(); expect(shiftCalendarDate('2026-12-31', 1)).toBe('2027-01-01'); });
    it.each([{ task: 'edit' }, { task: 'meal', mealId: '20', defaultSlot: '1' }, { task: 'meal', mealId: '0' }, { task: 'meal', defaultSlot: '9' }, { task: 'meal' }, { task: 'day', mealId: '20' }])('normalizes invalid task/selection %j', params => { expect(state.parse(convertToParamMap({ date: '2026-10-12', ...params }))).toBe(true); expect(state.task()).toBe('day'); expect(state.selection()).toEqual({ kind: 'none' }); });
    it('round trips mutually exclusive saved and virtual selections', () => { expect(state.parse(convertToParamMap({ date: '2026-10-12', task: 'meal', defaultSlot: '2' }))).toBe(false); expect(state.query()).toEqual({ date: '2026-10-12', task: 'meal', mealId: null, defaultSlot: 2 }); state.parse(convertToParamMap({ date: '2026-10-12', task: 'meal', mealId: '20' })); expect(state.query().defaultSlot).toBeNull(); expect(state.query().mealId).toBe(20); });
    it('clears temporary selection on identity reset', () => { state.parse(convertToParamMap({ date: '2026-10-12', task: 'meal', mealId: '20' })); TestBed.inject(MealPlanContextStore).reset(); expect(state.task()).toBe('day'); expect(state.selection()).toEqual({ kind: 'none' }); });
});

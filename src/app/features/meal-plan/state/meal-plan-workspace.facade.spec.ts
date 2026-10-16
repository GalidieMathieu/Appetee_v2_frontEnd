import { ManualItemDraftState } from '../state/manual-item-draft.state';
import { MealPlanOrderingState } from '../state/meal-plan-ordering.state';
import { CopyFlowState } from '../state/copy-flow.state';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { MealPlannerFacade } from '@app/core/shared/data-access/meal-plan/meal-planner.facade';
import { plannerRange } from '@app/core/shared/data-access/meal-plan/testing/meal-plan.fixtures';
import { MealPlanWorkspaceState } from './meal-plan-workspace.state';
import { MealPlanWorkspaceFacade } from './meal-plan-workspace.facade';
import { Location } from '@angular/common';
import { MealEditorDraftState } from './meal-editor-draft.state';
import { RecipePickerState } from './recipe-picker.state';
import { RecipePickerFacade } from '@app/core/shared/data-access/recipes/picker/recipe-picker.facade';
import { RecipeExperienceFacade } from '@app/core/shared/ui/recipe-experience/recipe-experience.facade';
describe('MealPlanWorkspaceFacade', () => {
    const params = new BehaviorSubject(convertToParamMap({ date: '2026-10-12', task: 'day' }));
    const loadRange = vi.fn(), activate = vi.fn(), navigate = vi.fn();
    const range = plannerRange('2026-10-12');
    let flow: MealPlanWorkspaceFacade;
    beforeEach(() => {
        loadRange.mockReset().mockReturnValue(of(range));
        activate.mockReset();
        navigate.mockReset();
        params.next(convertToParamMap({ date: '2026-10-12', task: 'day' }));
        TestBed.configureTestingModule({ providers: [ManualItemDraftState, MealPlanOrderingState, CopyFlowState, MealPlanWorkspaceFacade, MealPlanWorkspaceState, MealEditorDraftState, RecipePickerState,
{ provide: RecipePickerFacade, useValue: { apply: vi.fn(), clear: vi.fn() } },
{ provide: RecipeExperienceFacade, useValue: { openPreview: vi.fn() } },
{ provide: Location, useValue: { back: vi.fn() } }, { provide: ActivatedRoute, useValue: { queryParamMap: params } }, { provide: Router, useValue: { navigate } }, { provide: MealPlannerFacade, useValue: { loadRange, activate, endCopyReview: vi.fn(), pending: signal(false), reset$: new Subject(), paused: signal(false), revision: signal('8'), identityGeneration: signal(0), settings: signal(range.settings), range: () => ({ data: range, observedRevision: '8', request: { status: 'success', error: null }, freshness: 'fresh' }) } }] });
        flow = TestBed.inject(MealPlanWorkspaceFacade);
    });
    it('revalidates entry exactly once even when reads resolve synchronously', () => { flow.enter(); expect(loadRange).toHaveBeenCalledTimes(1); expect(activate).toHaveBeenCalledWith('2026-10-12', '2026-10-18'); });
    it('selects loaded dates and opens meals without another request', () => { flow.enter(); flow.selectDate('2026-10-12'); params.next(convertToParamMap({ date: '2026-10-12', task: 'day' })); expect(loadRange).toHaveBeenCalledTimes(1); flow.open(range.days[0]!.meals[0]!); params.next(convertToParamMap({ date: '2026-10-12', task: 'meal', mealId: '20' })); expect(TestBed.inject(MealPlanWorkspaceState).query().mealId).toBe(20); expect(navigate).toHaveBeenCalled(); expect(loadRange).toHaveBeenCalledTimes(1); });
    it('normalizes an unavailable meal to day context without manufacturing a slot', () => { flow.enter(); params.next(convertToParamMap({ date: '2026-10-12', task: 'meal', mealId: '999' })); expect(flow.task()).toBe('day'); expect(flow.selectedMeal()).toBeNull(); expect(navigate.mock.calls.at(-1)?.[1].replaceUrl).toBe(true); });
    it('week navigation changes only the URL and preserves GET-only ownership', () => { flow.enter(); flow.shiftWeek(1); expect(navigate.mock.calls.at(-1)?.[1].queryParams).toEqual({ date: '2026-10-19', task: 'day' }); expect(loadRange).toHaveBeenCalledTimes(1); });
});

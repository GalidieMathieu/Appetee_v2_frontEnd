import { ManualItemDraftState } from '../state/manual-item-draft.state';
import { MealPlanOrderingState } from '../state/meal-plan-ordering.state';
import { CopyFlowState } from '../state/copy-flow.state';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, provideRouter, convertToParamMap } from '@angular/router';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { MealPlannerApi } from '@app/core/shared/data-access/meal-plan/meal-planner.api';
import { MealPlannerFacade } from '@app/core/shared/data-access/meal-plan/meal-planner.facade';
import { MealPlanContextStore } from '@app/core/shared/data-access/meal-plan/meal-plan-context.store';
import { MealPlanMutationCoordinator } from '@app/core/shared/data-access/meal-plan/meal-plan-mutation-coordinator';
import { MealPlannerStore } from '@app/core/shared/data-access/meal-plan/meal-planner.store';
import { PlannerMutationDto } from '@app/core/shared/data-access/meal-plan/meal-plan-mutation.model';
import { plannerRange } from '@app/core/shared/data-access/meal-plan/testing/meal-plan.fixtures';
import { RecipePickerFacade } from '@app/core/shared/data-access/recipes/picker/recipe-picker.facade';
import { RecipeExperienceFacade } from '@app/core/shared/ui/recipe-experience/recipe-experience.facade';
import { MealPlanWorkspaceFacade } from './meal-plan-workspace.facade';
import { MealPlanWorkspaceState } from './meal-plan-workspace.state';
import { MealEditorDraftState } from './meal-editor-draft.state';
import { RecipePickerState } from './recipe-picker.state';

describe('F09/F10 confirmed planner writes', () => {
  const params = new BehaviorSubject(convertToParamMap({ date: '2026-10-12', task: 'meal', mealId: '20' }));
  const getRange = vi.fn(), renameMeal = vi.fn(), createMeal = vi.fn(), setRecipeQuantity = vi.fn(), deleteMeal = vi.fn(), addRecipeItem = vi.fn(), deleteItem = vi.fn();
  const addManualItem = vi.fn(), updateManualItem = vi.fn(), reorderItems = vi.fn(), reorderMeals = vi.fn();
  let flow: MealPlanWorkspaceFacade;
  let range = plannerRange('2026-10-12');
  function receipt(revision: string, changes: any = {}): PlannerMutationDto {
    return { revision, settings: range.settings, days: [{ ...range.days[0]!, ...changes }], createdMealId: null, createdItemId: null };
  }
  beforeEach(() => {
    range = plannerRange('2026-10-12');
    params.next(convertToParamMap({ date: range.from, task: 'meal', mealId: '20' }));
    for (const mock of [getRange, renameMeal, createMeal, setRecipeQuantity, deleteMeal, addRecipeItem, deleteItem, addManualItem, updateManualItem, reorderItems, reorderMeals]) mock.mockReset();
    getRange.mockImplementation((from: string, through: string) => {
      const days = []; const cursor = new Date(from + 'T12:00:00Z');
      while (cursor.toISOString().slice(0, 10) <= through) {
        const date = cursor.toISOString().slice(0, 10); days.push(date === range.from ? range.days[0] : { ...range.days[0]!, date, id: null, persistence: 'untouched', savedMealCount: 0, meals: [] });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return of({ ...range, from, through, days });
    });
    TestBed.configureTestingModule({ providers: [
      provideRouter([]), ManualItemDraftState, MealPlanOrderingState, CopyFlowState, MealPlanWorkspaceFacade, MealPlanWorkspaceState, MealEditorDraftState, RecipePickerState,
      { provide: ActivatedRoute, useValue: { queryParamMap: params } },
      { provide: MealPlannerApi, useValue: { getRange, renameMeal, createMeal, setRecipeQuantity, deleteMeal, addRecipeItem, deleteItem, addManualItem, updateManualItem, reorderItems, reorderMeals } },
      { provide: RecipePickerFacade, useValue: { apply: vi.fn(), clear: vi.fn(), loading: () => false, stale: () => false } },
      { provide: RecipeExperienceFacade, useValue: { openPreview: vi.fn() } },
      { provide: MAT_DIALOG_DEFAULT_OPTIONS, useValue: { enterAnimationDuration: 0, exitAnimationDuration: 0 } },
    ] });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    flow = TestBed.inject(MealPlanWorkspaceFacade); flow.enter(); TestBed.tick();
  });
  afterEach(() => { TestBed.inject(MealPlanMutationCoordinator).reset(); vi.useRealTimers(); vi.restoreAllMocks(); });
  it('coalesces rapid unsent names at 600 ms and applies Core before Saved', () => {
    vi.useFakeTimers(); const response = new Subject<PlannerMutationDto>(); renameMeal.mockReturnValue(response);
    flow.setName('Fast one'); flow.setName('Fast two'); vi.advanceTimersByTime(599); expect(renameMeal).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(renameMeal).toHaveBeenCalledExactlyOnceWith(20, { name: 'Fast two' }, '8');
    expect(flow.drafts.viewStatus()).toBe('saving');
    response.next(receipt('9', { meals: [{ ...range.days[0]!.meals[0]!, name: 'Fast two' }] }));
    expect(TestBed.inject(MealPlanContextStore).revision()).toBe('9'); expect(flow.selectedMeal()?.name).toBe('Fast two'); expect(flow.drafts.viewStatus()).toBe('saved');
  });
  it('keeps latest quantity 4 while 2 is in flight; never sends intermediate 3 or changes pending totals', () => {
    const first = new Subject<PlannerMutationDto>(), last = new Subject<PlannerMutationDto>();
    setRecipeQuantity.mockReturnValueOnce(first).mockReturnValueOnce(last);
    flow.setQuantity(30, 2); flow.setQuantity(30, 3); flow.setQuantity(30, 4);
    expect(setRecipeQuantity).toHaveBeenCalledTimes(1); expect(flow.selectedMeal()?.totals.caloriesKcal).toBe(500);
    first.next(receipt('9', { meals: [{ ...range.days[0]!.meals[0]!, items: [{ ...range.days[0]!.meals[0]!.items[0]!, quantity: 2 }] }] }));
    expect(setRecipeQuantity.mock.calls[1]).toEqual([30, { quantity: 4 }, '9']); expect(flow.drafts.quantities()[30]?.value).toBe(4);
    expect(flow.drafts.viewStatus()).not.toBe('saved'); last.next(receipt('10', { meals: [{ ...range.days[0]!.meals[0]!, items: [{ ...range.days[0]!.meals[0]!.items[0]!, quantity: 4 }] }] }));
    expect(flow.drafts.viewStatus()).toBe('saved');
  });
  it('queued names coalesce and an older acknowledgement never erases the newer input', () => {
    const first = new Subject<PlannerMutationDto>(), last = new Subject<PlannerMutationDto>();
    renameMeal.mockReturnValueOnce(first).mockReturnValueOnce(last);
    flow.setName('Name 2'); flow.flush(); flow.setName('Name 3'); flow.flush(); flow.setName('Name 4'); flow.flush();
    expect(renameMeal).toHaveBeenCalledTimes(1);
    first.next(receipt('9', { meals: [{ ...range.days[0]!.meals[0]!, name: 'Name 2' }] }));
    expect(flow.drafts.name()).toBe('Name 4'); expect(flow.drafts.viewStatus()).not.toBe('saved');
    expect(renameMeal.mock.calls[1]).toEqual([20, { name: 'Name 4' }, '9']);
    last.next(receipt('10', { meals: [{ ...range.days[0]!.meals[0]!, name: 'Name 4' }] }));
    expect(flow.drafts.viewStatus()).toBe('saved');
  });
  it('opens/cancels a virtual picker without a POST, and rename materializes only its confirmed ID', () => {
    const virtual = { ...range.days[0]!.meals[0]!, id: null, key: 'virtual:2026-10-12:1', defaultSlot: 1, isVirtual: true, items: [] };
    range = { ...range, days: [{ ...range.days[0]!, id: null, persistence: 'untouched', savedMealCount: 0, meals: [virtual] }] };
    TestBed.inject(MealPlanContextStore).reset(); TestBed.inject(MealPlannerStore).reset();
    params.next(convertToParamMap({ date: range.from, task: 'recipe-picker', defaultSlot: '1' })); TestBed.tick();
    expect(createMeal).not.toHaveBeenCalled(); expect(addRecipeItem).not.toHaveBeenCalled();
    flow.back(); expect(createMeal).not.toHaveBeenCalled();
    const response = new Subject<PlannerMutationDto>(); createMeal.mockReturnValue(response);
    flow.setName('Changed lunch'); flow.flush();
    expect(createMeal).toHaveBeenCalledWith(range.from, { name: 'Changed lunch', defaultSlot: 1 }, '8');
    expect(TestBed.inject(MealPlanWorkspaceState).selection()).toEqual({ kind: 'virtual', defaultSlot: 1 });
    response.next({ ...receipt('9', { id: 10, persistence: 'saved', savedMealCount: 1, meals: [{ ...virtual, id: 77, key: 'meal:77', isVirtual: false, defaultSlot: null, name: 'Changed lunch' }] }), createdMealId: 77 });
    expect(flow.selectedMeal()?.id).toBe(77); expect(TestBed.inject(MealPlanContextStore).revision()).toBe('9');
    expect(TestBed.inject(Router).navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ replaceUrl: true, queryParams: expect.objectContaining({ mealId: 77, defaultSlot: null }) }));
  });
  function keepSessionSuggestions(): void {
    const template = range.days[0]!.meals[0]!;
    const virtual = [1, 2, 3].map(slot => ({ ...template, id: null, key: 'virtual:' + range.from + ':' + slot,
      defaultSlot: slot, isVirtual: true, name: ['Breakfast', 'Lunch', 'Dinner'][slot - 1]!, items: [] }));
    range = { ...range, days: [{ ...range.days[0]!, id: null, persistence: 'untouched', savedMealCount: 0, meals: virtual }] };
    TestBed.inject(MealPlanContextStore).reset(); TestBed.inject(MealPlannerStore).reset();
    params.next(convertToParamMap({ date: range.from, task: 'meal', defaultSlot: '1' })); TestBed.tick();
    const first = { ...virtual[0]!, id: 77, key: 'meal:77', isVirtual: false, defaultSlot: null, name: 'Morning meal' };
    const result = { ...receipt('9', { id: 10, persistence: 'saved', savedMealCount: 1, meals: [first] }), createdMealId: 77 };
    createMeal.mockReturnValue(of(result)); flow.setName('Morning meal'); flow.flush(); TestBed.tick();
    range = { ...range, revision: '9', days: result.days };
    expect(flow.day()?.meals.map(meal => meal.name)).toEqual(['Morning meal', 'Lunch', 'Dinner']);
    expect(flow.snapshot()?.data?.days[0]?.meals).toHaveLength(1);
    createMeal.mockClear();
    params.next(convertToParamMap({ date: range.from, task: 'recipe-picker', defaultSlot: '2' })); TestBed.tick();
  }

  it('keeps sibling slots through date navigation and creates a retained recipe target before adding food', () => {
    keepSessionSuggestions();
    expect(createMeal).not.toHaveBeenCalled(); expect(addRecipeItem).not.toHaveBeenCalled();
    params.next(convertToParamMap({ date: '2026-10-13', task: 'day' })); TestBed.tick();
    params.next(convertToParamMap({ date: range.from, task: 'recipe-picker', defaultSlot: '2' })); TestBed.tick();
    expect(flow.selectedMeal()?.name).toBe('Lunch');
    const creating = new Subject<PlannerMutationDto>(), adding = new Subject<PlannerMutationDto>();
    createMeal.mockReturnValue(creating); addRecipeItem.mockReturnValue(adding);
    flow.addRecipe({ id: 43 } as any); flow.addRecipe({ id: 43 } as any);
    expect(createMeal).toHaveBeenCalledExactlyOnceWith(range.from, { name: 'Lunch' }, '9');
    expect(addRecipeItem).not.toHaveBeenCalled();
    const lunch = { ...range.days[0]!.meals[0]!, id: 78, key: 'meal:78', name: 'Lunch', sortOrder: 2 };
    creating.next({ ...receipt('10', { savedMealCount: 2, meals: [...range.days[0]!.meals, lunch] }), createdMealId: 78 });
    expect(addRecipeItem).toHaveBeenCalledExactlyOnceWith(range.from, { meal: { mealId: 78 }, recipeId: 43, quantity: 1 }, '10');
    expect(flow.selectedMeal()?.id).toBe(78);
    adding.error(new HttpErrorResponse({ status: 400, error: { code: 'csrf_invalid' } }));
    expect(flow.selectedMeal()?.items).toEqual([]);
    expect(flow.day()?.meals.map(meal => meal.name)).toEqual(['Morning meal', 'Lunch', 'Dinner']);
    expect(TestBed.inject(MealPlanContextStore).revision()).toBe('10');
    flow.addRecipe({ id: 43 } as any); expect(createMeal).toHaveBeenCalledTimes(1);
    range = { ...range, revision: '10', days: [flow.snapshot()!.data!.days[0]!] };
    flow.refresh(); TestBed.tick(); flow.confirmReview();
    const retry = new Subject<PlannerMutationDto>(); addRecipeItem.mockReturnValue(retry);
    flow.addRecipe({ id: 43 } as any);
    expect(createMeal).toHaveBeenCalledTimes(1);
    expect(addRecipeItem).toHaveBeenLastCalledWith(range.from, { meal: { mealId: 78 }, recipeId: 43, quantity: 1 }, '10');
    const food = { ...plannerRange(range.from).days[0]!.meals[0]!.items[0]!, id: 31, recipeId: 43 };
    retry.next({ ...receipt('11', { meals: range.days[0]!.meals.map(meal => meal.id === 78 ? { ...meal, items: [food] } : meal) }), createdItemId: 31 });
    expect(flow.selectedMeal()?.items).toHaveLength(1);
  });

  it('preserves a manual-food draft and the real meal after its second request fails', () => {
    keepSessionSuggestions();
    params.next(convertToParamMap({ date: range.from, task: 'manual', defaultSlot: '2' })); TestBed.tick();
    const creating = new Subject<PlannerMutationDto>(), adding = new Subject<PlannerMutationDto>();
    createMeal.mockReturnValue(creating); addManualItem.mockReturnValue(adding);
    flow.manual.form.setValue({ name: 'Food', caloriesKcal: '100', proteinG: '1', carbsG: '2', fatG: '3' }); flow.manual.form.markAsDirty();
    flow.submitManual();
    const lunch = { ...range.days[0]!.meals[0]!, id: 78, key: 'meal:78', name: 'Lunch', sortOrder: 2 };
    creating.next({ ...receipt('10', { savedMealCount: 2, meals: [...range.days[0]!.meals, lunch] }), createdMealId: 78 }); TestBed.tick();
    expect(addManualItem).toHaveBeenCalledExactlyOnceWith(range.from, { meal: { mealId: 78 }, manualItem: { name: 'Food', caloriesKcal: 100, proteinG: 1, carbsG: 2, fatG: 3 } }, '10');
    adding.error(new HttpErrorResponse({ status: 409, error: { code: 'meal_plan_revision_conflict' } }));
    expect(flow.manual.form.controls.name.value).toBe('Food'); expect(flow.manual.revision()).toBe('10');
    expect(flow.selectedMeal()?.id).toBe(78); expect(flow.manual.blocked()).toBe(true);
    flow.submitManual(); expect(createMeal).toHaveBeenCalledTimes(1);
  });

  it('does not add food after unconfirmed target creation or replay an unknown creation', () => {
    keepSessionSuggestions();
    const creating = new Subject<PlannerMutationDto>(); createMeal.mockReturnValue(creating);
    flow.addRecipe({ id: 43 } as any);
    creating.error(new HttpErrorResponse({ status: 500 }));
    expect(addRecipeItem).not.toHaveBeenCalled(); expect(flow.selectedMeal()?.isVirtual).toBe(true);
    flow.addRecipe({ id: 43 } as any); expect(createMeal).toHaveBeenCalledTimes(1);
  });

  it('does not issue the second request after the login identity is reset during creation', () => {
    keepSessionSuggestions();
    const creating = new Subject<PlannerMutationDto>(); createMeal.mockReturnValue(creating);
    flow.addRecipe({ id: 43 } as any);
    TestBed.inject(MealPlanContextStore).reset(); TestBed.inject(MealPlanMutationCoordinator).reset();
    const lunch = { ...range.days[0]!.meals[0]!, id: 78, key: 'meal:78', name: 'Lunch', sortOrder: 2 };
    creating.next({ ...receipt('10', { savedMealCount: 2, meals: [...range.days[0]!.meals, lunch] }), createdMealId: 78 });
    expect(addRecipeItem).not.toHaveBeenCalled();
    expect(TestBed.inject(MealPlanContextStore).revision()).toBeNull();
  });

  it('renames a retained suggestion using explicit creation, and logout removes all unused suggestions', () => {
    keepSessionSuggestions();
    const dinner = { ...range.days[0]!.meals[0]!, id: 78, key: 'meal:78', name: 'Late lunch', sortOrder: 2 };
    createMeal.mockReturnValue(of({ ...receipt('10', { savedMealCount: 2, meals: [...range.days[0]!.meals, dinner] }), createdMealId: 78 }));
    flow.setName('Late lunch'); flow.flush(); TestBed.tick();
    expect(createMeal).toHaveBeenCalledExactlyOnceWith(range.from, { name: 'Late lunch' }, '9');
    expect(flow.day()?.meals.map(meal => meal.name)).toEqual(['Morning meal', 'Late lunch', 'Dinner']);
    range = { ...range, revision: '10', days: [{ ...range.days[0]!, savedMealCount: 2, meals: [...range.days[0]!.meals, dinner] }] };
    TestBed.inject(MealPlanContextStore).reset(); TestBed.inject(MealPlannerStore).reset();
    params.next(convertToParamMap({ date: range.from, task: 'day' })); TestBed.tick();
    expect(flow.day()?.meals.map(meal => meal.name)).toEqual(['Morning meal', 'Late lunch']);
  });

  it('confirmed deletion retains an empty saved day and clears selection only after acknowledgement', async () => {
    const response = new Subject<PlannerMutationDto>(); deleteMeal.mockReturnValue(response);
    const deleting = flow.deleteMeal(); TestBed.inject(MatDialog).openDialogs[0]!.close('discard'); await deleting;
    expect(flow.selectedMeal()?.id).toBe(20); response.next(receipt('9', { meals: [], savedMealCount: 0 }));
    expect(flow.day()?.persistence).toBe('saved'); expect(flow.day()?.meals).toEqual([]); expect(flow.task()).toBe('day');
    range = { ...range, revision: '9', days: [{ ...range.days[0]!, meals: [], savedMealCount: 0 }] };
    flow.refresh(); expect(flow.day()?.meals).toEqual([]);
  });
  it('500 is unknown, never replayed, and refresh alone cannot authorize the draft', () => {
    const response = new Subject<PlannerMutationDto>(); renameMeal.mockReturnValue(response);
    flow.setName('Unsure'); flow.flush(); response.error(new HttpErrorResponse({ status: 500 }));
    expect(flow.drafts.viewStatus()).toBe('unknownOutcome'); expect(TestBed.inject(MealPlanContextStore).revision()).toBe('8');
    flow.flush(); expect(renameMeal).toHaveBeenCalledTimes(1);
    range = { ...range, revision: '10' }; flow.refresh(); TestBed.tick();
    expect(flow.drafts.name()).toBe('Unsure'); expect(flow.drafts.revision()).toBe('8');
    flow.confirmReview(); expect(flow.drafts.revision()).toBe('10'); expect(renameMeal).toHaveBeenCalledTimes(1);
  });
  it('invalid input and confirmed CSRF rejection preserve draft without automatic replay', () => {
    flow.setName(''); flow.flush(); expect(renameMeal).not.toHaveBeenCalled(); expect(flow.drafts.validationAttempt()).toBe(true);
    const response = new Subject<PlannerMutationDto>(); renameMeal.mockReturnValue(response); flow.setName('Valid'); flow.flush();
    response.error(new HttpErrorResponse({ status: 400, error: { code: 'csrf_invalid' } }));
    expect(flow.drafts.viewStatus()).toBe('failed'); expect(flow.drafts.name()).toBe('Valid');
    flow.flush(); expect(renameMeal).toHaveBeenCalledTimes(1);
  });
  it('discard waits for already-sent rename but does not submit a later unsent value', async () => {
    const response = new Subject<PlannerMutationDto>(); renameMeal.mockReturnValue(response);
    flow.setName('Sent'); flow.flush(); flow.setName('Discard me');
    const leaving = flow.canLeave(); TestBed.inject(MatDialog).openDialogs[0]!.close('discard');
    await new Promise(resolve => setTimeout(resolve, 20));
    response.next(receipt('9', { meals: [{ ...range.days[0]!.meals[0]!, name: 'Sent' }] }));
    expect(await leaving).toBe(true); expect(renameMeal).toHaveBeenCalledTimes(1);
  });
  it('identity reset cancels late feature adoption', () => {
    const response = new Subject<PlannerMutationDto>(); renameMeal.mockReturnValue(response);
    flow.setName('Old account'); flow.flush(); TestBed.inject(MealPlanContextStore).reset(); TestBed.inject(MealPlanMutationCoordinator).reset();
    response.next(receipt('9')); expect(flow.drafts.name()).toBe(''); expect(TestBed.inject(MealPlanContextStore).revision()).toBeNull();
  });
  it('blocks confirmed duplicates and exposes a server duplicate rejection without increment/upsert', () => {
    expect(flow.inMeal(40)).toBe(true);
    flow.addRecipe({ id: 40 } as any); expect(addRecipeItem).not.toHaveBeenCalled();
    const response = new Subject<PlannerMutationDto>(); addRecipeItem.mockReturnValue(response);
    flow.addRecipe({ id: 43 } as any);
    expect(addRecipeItem).toHaveBeenCalledExactlyOnceWith(range.from, { meal: { mealId: 20 }, recipeId: 43, quantity: 1 }, '8');
    response.error(new HttpErrorResponse({ status: 409, error: { code: 'recipe_already_in_meal' } }));
    expect(flow.drafts.error()).toContain('already in the meal');
    expect(flow.selectedMeal()?.items).toHaveLength(1); expect(TestBed.inject(MealPlanContextStore).revision()).toBe('8');
    flow.addRecipe({ id: 43 } as any); expect(addRecipeItem).toHaveBeenCalledTimes(1);
  });
  it('rejects an add receipt missing its created virtual meal identity without guessing or replaying', () => {
    const core = TestBed.inject(MealPlannerFacade);
    addRecipeItem.mockReturnValue(of({ ...receipt('9'), createdMealId: null, createdItemId: 30 }));
    let result: any;
    core.addRecipe(range.from, { meal: { defaultSlot: 2 }, recipeId: 43, quantity: 1 }, '8').subscribe(value => result = value);
    expect(result.outcome).toBe('unknownOutcome'); expect(result.createdMealId).toBeNull();
    expect(TestBed.inject(MealPlanContextStore).revision()).toBe('8'); expect(addRecipeItem).toHaveBeenCalledTimes(1);
  });
  it('does not let an unrelated route with matching query parameters bypass pending changes', async () => {
    flow.setName('');
    const leaving = flow.canLeave('/profile?date=2026-10-12&task=meal&mealId=20');
    const dialog = TestBed.inject(MatDialog).openDialogs[0]; expect(dialog).toBeDefined();
    dialog!.close('stay'); expect(await leaving).toBe(false);
  });
  it('manual open/type/cancel is read-only and a dirty Back requires Stay/Discard', async () => {
    params.next(convertToParamMap({ date: range.from, task: 'manual', mealId: '20' })); TestBed.tick();
    flow.manual.form.controls.name.setValue('Draft food'); flow.manual.form.markAsDirty();
    const leaving = flow.canLeave('/meal-plan/planner?date=2026-10-12&task=meal&mealId=20');
    TestBed.inject(MatDialog).openDialogs[0]!.close('stay'); expect(await leaving).toBe(false);
    expect(flow.manual.form.controls.name.value).toBe('Draft food'); expect(addManualItem).not.toHaveBeenCalled();
    const discarding = flow.canLeave(); TestBed.inject(MatDialog).openDialogs[0]!.close('discard'); expect(await discarding).toBe(true);
    expect(flow.manual.key()).toBeNull(); expect(addManualItem).not.toHaveBeenCalled();
  });
  it('valid manual Add is one complete command and closes only after synchronized receipt', () => {
    params.next(convertToParamMap({ date: range.from, task: 'manual', mealId: '20' })); TestBed.tick();
    const response = new Subject<PlannerMutationDto>(); addManualItem.mockReturnValue(response);
    flow.manual.form.setValue({ name: 'Food', caloriesKcal: '100', proteinG: '1', carbsG: '2', fatG: '3' }); flow.submitManual(); flow.submitManual();
    expect(addManualItem).toHaveBeenCalledExactlyOnceWith(range.from, { meal: { mealId: 20 }, manualItem: { name: 'Food', caloriesKcal: 100, proteinG: 1, carbsG: 2, fatG: 3 } }, '8');
    expect(flow.manual.key()).not.toBeNull(); expect(flow.selectedMeal()?.items).toHaveLength(1);
    response.next({ ...receipt('9', { meals: [{ ...range.days[0]!.meals[0]!, items: [...range.days[0]!.meals[0]!.items, { id: 55, type: 'manual', sortOrder: 2, name: 'Food', nutrition: { caloriesKcal: 100, proteinG: 1, carbsG: 2, fatG: 3 } }] }] }), createdItemId: 55 });
    expect(TestBed.inject(MealPlanContextStore).revision()).toBe('9'); expect(flow.selectedMeal()?.items).toHaveLength(2); expect(flow.manual.key()).toBeNull();
  });
  it('a pending manual receipt does not override the destination chosen by an awaiting navigation guard', async () => {
    params.next(convertToParamMap({ date: range.from, task: 'manual', mealId: '20' })); TestBed.tick();
    const response = new Subject<PlannerMutationDto>(); addManualItem.mockReturnValue(response);
    flow.manual.form.setValue({ name: 'Food', caloriesKcal: '100', proteinG: '1', carbsG: '2', fatG: '3' }); flow.manual.form.markAsDirty(); flow.submitManual();
    const router = TestBed.inject(Router); vi.mocked(router.navigate).mockClear();
    const leaving = flow.canLeave('/profile'); expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
    response.next({ ...receipt('9', { meals: [{ ...range.days[0]!.meals[0]!, items: [...range.days[0]!.meals[0]!.items, { id: 55, type: 'manual', sortOrder: 2, name: 'Food', nutrition: { caloriesKcal: 100, proteinG: 1, carbsG: 2, fatG: 3 } }] }] }), createdItemId: 55 });
    expect(await leaving).toBe(true); expect(router.navigate).not.toHaveBeenCalled(); expect(addManualItem).toHaveBeenCalledTimes(1);
  });
  it('manual failures preserve fields/base context and refresh never submits or authorizes silently', () => {
    params.next(convertToParamMap({ date: range.from, task: 'manual', mealId: '20' })); TestBed.tick();
    const response = new Subject<PlannerMutationDto>(); addManualItem.mockReturnValue(response);
    flow.manual.form.setValue({ name: 'Draft', caloriesKcal: '100', proteinG: '1', carbsG: '2', fatG: '3' }); flow.manual.form.markAsDirty(); flow.submitManual();
    response.error(new HttpErrorResponse({ status: 409, error: { code: 'meal_plan_revision_conflict' } }));
    expect(flow.manual.form.controls.name.value).toBe('Draft'); expect(flow.selectedMeal()?.items).toHaveLength(1);
    range = { ...range, revision: '9' }; flow.refresh(); TestBed.tick();
    expect(flow.manual.revision()).toBe('8'); flow.submitManual(); expect(addManualItem).toHaveBeenCalledTimes(1);
    flow.confirmReview(); expect(flow.manual.revision()).toBe('9'); expect(addManualItem).toHaveBeenCalledTimes(1);
  });
  it('manual Edit rejects a recipe or another meal item and does not invent a draft entity', () => {
    params.next(convertToParamMap({ date: range.from, task: 'manual', mealId: '20', itemId: '30' })); TestBed.tick();
    expect(flow.task()).toBe('meal'); expect(flow.manual.key()).toBeNull(); expect(updateManualItem).not.toHaveBeenCalled();
  });
  it('ordering submits one complete membership, previews only IDs and restores confirmed order on conflict', () => {
    const second = { ...range.days[0]!.meals[0]!.items[0]!, id: 31, recipeId: 41 };
    range = { ...range, days: [{ ...range.days[0]!, meals: [{ ...range.days[0]!.meals[0]!, items: [range.days[0]!.meals[0]!.items[0]!, second] }] }] };
    flow.refresh(); TestBed.tick(); const response = new Subject<PlannerMutationDto>(); reorderItems.mockReturnValue(response);
    flow.startOrder('item'); expect(reorderItems).not.toHaveBeenCalled(); flow.reorder('item', { from: 0, to: 1 });
    expect(reorderItems).toHaveBeenCalledExactlyOnceWith(20, { orderedIds: [31, 30] }, '8');
    expect(flow.editorMeal()?.items.map(item => item.id)).toEqual([31, 30]); expect(flow.selectedMeal()?.items.map(item => item.id)).toEqual([30, 31]);
    response.error(new HttpErrorResponse({ status: 409 })); expect(flow.editorMeal()?.items.map(item => item.id)).toEqual([30, 31]);
    expect(flow.ordering.focus()?.id).toBe(30); expect(TestBed.inject(MealPlanContextStore).revision()).toBe('8');
  });
});

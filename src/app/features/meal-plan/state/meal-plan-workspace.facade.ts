import { DOCUMENT, Location } from '@angular/common';
import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Observable, Subject, concatMap, debounceTime, firstValueFrom, of, takeUntil } from 'rxjs';
import { MealPlannerFacade } from '@app/core/shared/data-access/meal-plan/meal-planner.facade';
import { PlannerMealDto } from '@app/core/shared/data-access/meal-plan/meal-plan.model';
import { ManualItemDraftState } from './manual-item-draft.state';
import { MealPlanOrderingState, movedIds } from './meal-plan-ordering.state';
import { CopyFlowState, copyRange } from './copy-flow.state';
import { CopyMode, CopyReviewView } from '../models/copy-intent.model';
import { CopyDayDialogComponent } from '../planner/copy-day-dialog.component';
import { CopyWeekDialogComponent } from '../planner/copy-week-dialog.component';
import { MatDialogRef } from '@angular/material/dialog';
import { PlannerOperationResult } from '@app/core/shared/data-access/meal-plan/meal-plan-mutation.model';
import { RecipeCardAdvance } from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipePickerFacade } from '@app/core/shared/data-access/recipes/picker/recipe-picker.facade';
import { RecipeExperienceFacade } from '@app/core/shared/ui/recipe-experience/recipe-experience.facade';
import { MealPlanWorkspaceState, localCalendarDate, shiftCalendarDate } from './meal-plan-workspace.state';
import { WeekDateView } from '../models/meal-plan-workspace.model';
import { MealEditorDraftState, validMealName, validRecipeQuantity } from './meal-editor-draft.state';
import { RecipePickerState } from './recipe-picker.state';
import { PlannerDecisionDialog } from '../planner/planner-decision.dialog';
import { PlannerSessionSlotsState } from './planner-session-slots.state';

@Injectable()
export class MealPlanWorkspaceFacade {
  private readonly core = inject(MealPlannerFacade);
  private readonly sessionSlots = inject(PlannerSessionSlotsState);
  private readonly state = inject(MealPlanWorkspaceState);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly document = inject(DOCUMENT);
  private readonly dialogs = inject(MatDialog);
  private readonly experience = inject(RecipeExperienceFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly exit$ = new Subject<void>();
  private entered = false;
  private deciding = false;
  private discarding = false;
  private navigationSaving = false;
  private lastFreshRead: string | null = null;
  readonly drafts = inject(MealEditorDraftState);
  readonly picker = inject(RecipePickerFacade);
  readonly pickerState = inject(RecipePickerState);
  readonly manual = inject(ManualItemDraftState);
  readonly ordering = inject(MealPlanOrderingState);
  readonly copy = inject(CopyFlowState);
  private copyDialog: MatDialogRef<CopyDayDialogComponent> | null = null;
  readonly date = this.state.date;
  readonly task = this.state.task;
  readonly week = this.state.week;
  readonly structuralPending = signal(false);
  readonly pendingRecipeId = signal<number | null>(null);
  readonly snapshot = computed(() => this.core.range(this.rangeKey()));
  private readonly savedDay = computed(() => this.snapshot()?.data?.days.find(day => day.date === this.date()) ?? null);
  readonly day = computed(() => {
    const day = this.savedDay();
    return day ? this.sessionSlots.project(day) : null;
  });
  readonly selectedMeal = computed(() => {
    const selection = this.state.selection();
    return this.day()?.meals.find(meal => selection.kind === 'saved' ? meal.id === selection.mealId
      : selection.kind === 'virtual' ? meal.isVirtual && meal.defaultSlot === selection.defaultSlot : false) ?? null;
  });
  readonly displayDay = computed(() => {
    const day = this.day(), ids = this.ordering.parent() === 'day:' + this.date() ? this.ordering.ids() : null;
    return day && ids ? { ...day, meals: [...ids.flatMap(id => day.meals.filter(meal => meal.id === id)), ...day.meals.filter(meal => meal.isVirtual)] } : day;
  });
  readonly editorMeal = computed(() => {
    const meal = this.selectedMeal(), ids = this.ordering.parent() === 'meal:' + meal?.id ? this.ordering.ids() : null;
    return meal && ids ? { ...meal, items: ids.flatMap(id => meal.items.filter(item => item.id === id)) } : meal;
  });
  readonly weekDates = computed<readonly WeekDateView[]>(() => this.state.dates().map(date => {
    const day = this.snapshot()?.data?.days.find(day => day.date === date);
    return { date, savedMealCount: day?.savedMealCount ?? null, caloriesKcal: day?.totals.caloriesKcal ?? null };
  }));
  readonly settings = this.core.settings;
  readonly recipeIds = computed(() => this.selectedMeal()?.items.flatMap(item => item.type === 'recipe' ? [item.recipeId] : []) ?? []);
  readonly pending = this.core.pending;
  readonly canWrite = computed(() => !this.core.paused() && this.snapshot()?.freshness === 'fresh' && this.snapshot()?.request.status === 'success'
    && this.snapshot()?.observedRevision === this.core.revision() && !this.drafts.blocked());
  readonly actionsReady = computed(() => this.task() !== 'manual' && this.canWrite() && !this.core.pending() && !this.structuralPending()
    && !this.drafts.dirty() && !this.drafts.saving());
  readonly canAddMeal = computed(() => this.actionsReady() && !!this.day() && this.day()!.savedMealCount < 12);
  readonly canAddRecipe = computed(() => this.actionsReady() && !!this.selectedMeal() && this.selectedMeal()!.items.length < 20
    && (!this.selectedMeal()!.isVirtual || this.day()!.savedMealCount < 12));
  readonly canReview = computed(() => (this.drafts.blocked() || this.manual.blocked()) && this.lastReadRevision() !== null
    && this.lastReadRevision() === this.core.revision() && this.snapshot()?.freshness === 'fresh' && !this.core.pending());
  private readonly lastReadRevision = signal<string | null>(null);
  readonly canSubmitManual = computed(() => this.task() === 'manual' && this.canWrite() && !this.manual.blocked() && !this.pending()
    && !this.structuralPending() && this.manual.revision() === this.snapshot()?.observedRevision
    && !!this.selectedMeal() && (this.manual.editingId() !== null || this.selectedMeal()!.items.length < 20)
    && (!this.selectedMeal()!.isVirtual || this.day()!.savedMealCount < 12));
  readonly copyView = computed<CopyReviewView>(() => {
    const source = copyRange(this.copy.source(), this.copy.mode()), destination = copyRange(this.copy.destination(), this.copy.mode());
    const a = source ? this.core.range(source.from + ':' + source.through) : null;
    const b = destination ? this.core.range(destination.from + ':' + destination.through) : null;
    const reviewed = this.copy.reviewedRevision();
    const fresh = !!reviewed && a?.freshness === 'fresh' && b?.freshness === 'fresh'
      && a.request.status === 'success' && b.request.status === 'success'
      && a.observedRevision === reviewed && b.observedRevision === reviewed && this.core.revision() === reviewed;
    const unavailable = fresh && a?.data?.days.some(day => day.meals.some(meal => meal.items.some(item => item.type === 'recipe' && item.availability === 'unavailable')));
    const rows = fresh ? (a?.data?.days ?? []).map((day, index) => {
      const target = b!.data!.days[index]!;
      const describe = (value: typeof day) => value.persistence === 'untouched' ? 'Absent (no saved structure)' : !value.meals.length ? 'Saved empty day' : 'Saved day';
      return { source: day.date, destination: target.date, sourceState: describe(day), destinationState: describe(target),
        meals: target.savedMealCount, items: target.meals.reduce((count, meal) => count + meal.items.length, 0), clears: day.persistence === 'untouched',
        content: target.persistence === 'saved' ? target.meals.map(meal => ({ meal: meal.name, items: meal.items.map(item => item.name ?? 'Unavailable recipe') })) : [] };
    }) : [];
    return { source: this.copy.source(), destination: this.copy.destination(), rows, confirmed: this.copy.confirmed(),
      requiresReplacement: fresh && !!b?.data?.days.some(day => day.persistence === 'saved'),
      ready: !!fresh && !unavailable, pending: this.structuralPending(), loading: a?.request.status === 'loading' || b?.request.status === 'loading',
      error: this.copy.message() ?? a?.request.error ?? b?.request.error ?? (unavailable ? 'A source recipe is unavailable. Remove or replace it before copying.' : null) };
  });

  constructor() {
    this.core.reset$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.drafts.clear(); this.pickerState.clear(); this.structuralPending.set(false); this.pendingRecipeId.set(null);
      this.lastReadRevision.set(null); this.lastFreshRead = null; this.dialogs.closeAll();
      this.manual.clear(); this.ordering.reset(); this.copy.clear();
    });
    this.drafts.changes$.pipe(debounceTime(600), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.entered && !this.deciding) this.flush(false);
    });
    effect(() => {
      const meal = this.selectedMeal(), revision = this.snapshot()?.observedRevision;
      if (meal && revision) untracked(() => this.drafts.bind(meal, revision));
    });
    effect(() => { const pending = this.structuralPending(); if (this.copyDialog) this.copyDialog.disableClose = pending; });
    effect(() => {
      const reviewed = this.copy.reviewedRevision(), revision = this.core.revision();
      if (reviewed && reviewed !== revision && !this.structuralPending()) untracked(() => this.copy.invalidate());
    });
  }
  private rangeKey(): string { return this.week().from + ':' + this.week().through; }
  enter(): void {
    if (this.entered) return;
    this.entered = true;
    let first = true;
    this.route.queryParamMap.pipe(takeUntil(this.exit$), takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const oldKey = this.rangeKey();
      if (this.state.parse(params)) { this.navigate(true); return; }
      const { from, through } = this.week(); this.core.activate(from, through);
      if (first || oldKey !== this.rangeKey() || !this.snapshot()?.data) this.refresh();
      else this.resolveSelection();
      first = false;
    });
  }
  refresh(): void {
    if (this.core.pending() && !this.core.paused()) return;
    if (this.copyDialog) this.copy.invalidate();
    const { from, through } = this.week();
    this.core.loadRange(from, through).pipe(takeUntil(this.exit$), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (this.week().from !== from || this.week().through !== through) return;
        for (const day of this.snapshot()?.data?.days ?? []) this.sessionSlots.remember(day);
        this.lastFreshRead = this.snapshot()?.observedRevision ?? null;
        this.lastReadRevision.set(this.lastFreshRead);
        this.resolveSelection();
      }, error: () => undefined,
    });
  }
  private resolveSelection(): void {
    if (this.task() !== 'day' && this.day() && !this.selectedMeal()) {
      const selection = this.state.selection();
      const alias = selection.kind === 'virtual' ? this.sessionSlots.alias(this.date(), selection.defaultSlot) ?? this.state.alias(this.date(), selection.defaultSlot) : null;
      if (alias && this.day()!.meals.some(meal => meal.id === alias)) {
        this.state.selection.set({ kind: 'saved', mealId: alias }); this.drafts.rekey('meal:' + alias); this.navigate(true);
      } else {
        this.state.clearAliases(); this.state.task.set('day'); this.state.selection.set({ kind: 'none' }); this.navigate(true);
      }
    }
    if (this.task() === 'manual' && this.selectedMeal()) {
      const itemId = this.state.manualItemId(), item = this.selectedMeal()!.items.find(item => item.id === itemId);
      if (itemId !== null && item?.type !== 'manual') {
        this.state.task.set('meal'); this.state.manualItemId.set(null); this.navigate(true); return;
      }
      const revision = this.snapshot()?.observedRevision;
      if (revision) {
        this.manual.bind(this.date() + ':' + this.selectedMeal()!.key + ':' + (itemId ?? 'new'), revision, item?.type === 'manual' ? item : undefined);
        if (this.manual.revision() !== revision && !this.structuralPending()) {
          this.manual.blocked.set(true); this.manual.error.set('Saved context changed. Refresh and review before submitting your preserved draft.');
        }
      }
    }
    if (this.task() === 'recipe-picker' && this.selectedMeal()) this.picker.apply(this.pickerState.submit(), this.pickerState.savedOnly());
  }
  selectDate(date: string): void { if (this.state.dates().includes(date)) this.jump(date); }
  jump(date: string): void { void this.router.navigate([], { relativeTo: this.route, queryParams: { date, task: 'day' } }); }
  today(): void { this.jump(localCalendarDate()); }
  shiftWeek(direction: number): void { const date = shiftCalendarDate(this.date(), direction * 7); if (date) this.jump(date); }
  open(meal: PlannerMealDto): void {
    if (!this.day()?.meals.some(value => value.key === meal.key)) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { date: this.date(), task: 'meal',
      mealId: meal.isVirtual ? null : meal.id, defaultSlot: meal.isVirtual ? meal.defaultSlot : null },
      state: { mealPlanParent: { date: this.date(), task: 'day' } } });
  }
  openPicker(): void {
    if (!this.canAddRecipe()) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { ...this.state.query(), task: 'recipe-picker' },
      state: { mealPlanParent: { date: this.date(), task: 'meal' } } });
  }
  back(): void {
    const parentTask = this.task() === 'recipe-picker' || this.task() === 'manual' ? 'meal' : 'day';
    const parent = this.document.defaultView?.history.state?.mealPlanParent;
    if (parent?.date === this.date() && parent?.task === parentTask) { this.location.back(); return; }
    void this.router.navigate([], { relativeTo: this.route,
      queryParams: parentTask === 'meal' ? { ...this.state.query(), task: 'meal', itemId: null } : { date: this.date(), task: 'day' }, replaceUrl: true });
  }
  private navigate(replaceUrl = false): void { void this.router.navigate([], { relativeTo: this.route, queryParams: this.state.query(), replaceUrl }); }
  setName(name: string): void { this.drafts.setName(name); }
  setQuantity(id: number, value: string | number): void {
    const item = this.selectedMeal()?.items.find(item => item.id === id);
    if (item?.type !== 'recipe' || item.availability !== 'available') return;
    this.drafts.setQuantity(id, value); this.flushQuantities();
  }
  adjustQuantity(id: number, delta: number): void {
    const value = this.drafts.quantities()[id]?.value;
    if (value === undefined || !validRecipeQuantity(value)) return;
    const next = Number(value) + delta; if (next >= 1 && next <= 20) this.setQuantity(id, next);
  }
  flush(showValidation = true): void {
    if (this.discarding || this.deciding && !this.navigationSaving) return;
    if (showValidation && this.selectedMeal() && !this.drafts.valid()) { this.drafts.validationAttempt.set(true); return; }
    this.flushName(); this.flushQuantities();
  }
  private flushName(): void {
    const meal = this.selectedMeal(), draft = this.drafts, version = draft.nameVersion(), revision = draft.revision();
    if (!meal || !revision || !this.canWrite() || this.structuralPending() || !draft.hasNameChange()
      || !validMealName(draft.name()) || draft.submittedName() === version
      || meal.isVirtual && (draft.saving() || this.day()!.savedMealCount >= 12)) return;
    const name = draft.name().trim().normalize('NFC'), key = 'name:' + version;
    draft.submittedName.set(version); draft.begin(key);
    const date = this.date(), slot = meal.defaultSlot;
    const request = meal.isVirtual && slot !== null
      ? this.core.createMeal(date, { name, ...(this.savedDay()?.persistence === 'untouched' ? { defaultSlot: slot } : {}) }, revision)
      : this.core.renameMeal(meal.id!, name, revision);
    this.observe(request, result => {
      draft.settle(key);
      if (draft.submittedName() === version) draft.submittedName.set(null);
      if (result.outcome === 'confirmed' && result.revision) {
        draft.ackName(version, name, result.revision);
        if (meal.isVirtual && slot !== null && result.createdMealId !== null) this.materialized(date, slot, result.createdMealId);
        this.flush(false);
      } else this.fail(result);
    });
  }
  private flushQuantities(): void {
    if (this.discarding || this.deciding && !this.navigationSaving) return;
    if (!this.canWrite() || this.structuralPending()) return;
    const revision = this.drafts.revision(); if (!revision) return;
    for (const [text, item] of Object.entries(this.drafts.quantities())) {
      const id = Number(text), version = item.version, value = Number(item.value);
      if (!validRecipeQuantity(item.value) || value === item.baseline || item.submitted === version) continue;
      const recipe = this.selectedMeal()?.items.find(item => item.id === id);
      if (recipe?.type !== 'recipe' || recipe.availability !== 'available') continue;
      const key = 'quantity:' + id + ':' + version;
      this.drafts.quantities.update(state => ({ ...state, [id]: { ...state[id]!, submitted: version } }));
      this.drafts.begin(key);
      this.observe(this.core.setRecipeQuantity(id, value, revision), result => {
        this.drafts.settle(key);
        const current = this.drafts.quantities()[id];
        if (current?.submitted === version) this.drafts.quantities.update(state => ({ ...state, [id]: { ...current, submitted: null } }));
        if (result.outcome === 'confirmed' && result.revision) { this.drafts.ackQuantity(id, version, value, result.revision); this.flushQuantities(); }
        else this.fail(result);
      });
    }
  }
  private observe(request: Observable<PlannerOperationResult>, next: (result: PlannerOperationResult) => void): void {
    const generation = this.core.identityGeneration();
    request.pipe(takeUntil(this.exit$), takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (generation === this.core.identityGeneration()) next(result);
    });
  }
  private fail(result: PlannerOperationResult): void {
    if (['cancelled', 'superseded', 'duplicate'].includes(result.outcome)) return;
    if (result.outcome === 'confirmed') return;
    this.lastReadRevision.set(null);
    const message = result.outcome === 'unknownOutcome' ? 'Outcome unknown. Refresh and inspect saved meals before trying another action.'
      : result.code === 'recipe_already_in_meal' ? 'This recipe is already in the meal. Refresh and review the saved items.'
      : result.code === 'meal_limit_reached' ? 'This day has reached its limit of 12 meals. Refresh and review the day.'
      : result.code === 'item_limit_reached' ? 'This meal has reached its limit of 20 items. Refresh and review the meal.'
      : result.outcome === 'conflict' ? 'The saved context changed. Refresh and review before choosing another action.'
      : result.httpStatus === 404 ? 'This meal or recipe is unavailable. Refresh the day.'
      : result.code === 'csrf_invalid' ? 'The request was rejected before saving. Refresh and review before submitting again.'
      : 'Could not save. Your draft is preserved. Refresh and review before submitting again.';
    this.drafts.fail(result.outcome === 'unknownOutcome' ? 'unknownOutcome' : result.outcome === 'conflict' ? 'conflict' : 'failed', message);
    this.drafts.fieldErrors.set(result.errors ?? {}); this.drafts.diagnostic.set(result.traceId ?? null);
    const meal = this.selectedMeal();
    if (meal?.id) this.core.cancelUnsent('meal:' + meal.id);
    for (const id of Object.keys(this.drafts.quantities())) this.core.cancelUnsent('item:' + id);
  }
  private materialized(date: string, slot: number, id: number): void {
    this.sessionSlots.consume(date, slot, id);
    this.state.rememberMaterialization(date, slot, id); this.drafts.rekey('meal:' + id);
    this.state.selection.set({ kind: 'saved', mealId: id }); this.state.task.set('meal'); this.navigate(true);
  }
  newMeal(): void {
    if (!this.canAddMeal()) return;
    const date = this.date(), revision = this.snapshot()!.observedRevision!;
    this.structuralPending.set(true);
    this.observe(this.core.createMeal(date, { name: 'New Meal' }, revision), result => {
      this.structuralPending.set(false);
      if (result.outcome === 'confirmed' && result.createdMealId !== null) {
        this.drafts.clear();
        if (!this.deciding) { this.state.selection.set({ kind: 'saved', mealId: result.createdMealId }); this.state.task.set('meal'); this.navigate(); }
      } else this.fail(result);
    });
  }
  async deleteMeal(): Promise<void> {
    const meal = this.selectedMeal(), revision = this.drafts.revision();
    if (!meal || meal.isVirtual || meal.id === null || !revision || !this.actionsReady()) return;
    if (meal.items.length && await firstValueFrom(this.dialogs.open(PlannerDecisionDialog, { data: {
      title: 'Delete ' + meal.name + '?', message: 'This removes the meal and all its food. The saved day is kept, even if empty.', deletion: true,
    } }).afterClosed()) !== 'discard') return;
    if (!this.actionsReady() || this.selectedMeal()?.id !== meal.id || this.drafts.revision() !== revision) return;
    this.structuralPending.set(true);
    this.observe(this.core.deleteMeal(meal.id, meal.items.map(item => item.id), revision), result => {
      this.structuralPending.set(false);
      if (result.outcome === 'confirmed') { this.drafts.clear(); this.state.task.set('day'); this.state.selection.set({ kind: 'none' }); if (!this.deciding) this.navigate(true); }
      else this.fail(result);
    });
  }
  removeItem(id: number): void {
    const revision = this.drafts.revision();
    if (!revision || !this.actionsReady() || !this.selectedMeal()?.items.some(item => item.id === id)) return;
    this.structuralPending.set(true);
    this.observe(this.core.removeItem(id, revision), result => { this.structuralPending.set(false); if (result.outcome !== 'confirmed') this.fail(result); });
  }
  inMeal(id: number): boolean { return this.selectedMeal()?.items.some(item => item.type === 'recipe' && item.recipeId === id) ?? false; }
  addRecipe(recipe: RecipeCardAdvance): void {
    const meal = this.selectedMeal(), revision = this.drafts.revision();
    if (!meal || !revision || !this.canAddRecipe() || this.inMeal(recipe.id) || this.picker.loading() || this.picker.stale()) return;
    const date = this.date(), slot = meal.defaultSlot;
    this.structuralPending.set(true); this.pendingRecipeId.set(recipe.id);
    this.observe(this.withSavedTarget(meal, date, revision, (target, base) => this.core.addRecipe(date, { meal: target.isVirtual ? { defaultSlot: slot! } : { mealId: target.id! }, recipeId: recipe.id, quantity: 1 }, base)), result => {
      this.structuralPending.set(false); this.pendingRecipeId.set(null);
      if (result.outcome === 'confirmed') {
        if (meal.isVirtual && slot !== null && result.createdMealId !== null) {
          this.sessionSlots.consume(date, slot, result.createdMealId);
          this.state.rememberMaterialization(date, slot, result.createdMealId); this.drafts.rekey('meal:' + result.createdMealId);
          this.state.selection.set({ kind: 'saved', mealId: result.createdMealId });
        }
        if (result.revision) this.drafts.revision.set(result.revision);
        if (!this.deciding) this.back();
      } else this.fail(result);
    });
  }
  search(): void { this.picker.apply(this.pickerState.submit(), this.pickerState.savedOnly()); }
  savedTab(saved: boolean): void { this.pickerState.savedOnly.set(saved); this.search(); }
  preview(recipe: RecipeCardAdvance): void { this.experience.openPreview(recipe); }
  openManual(itemId?: number): void {
    if (!this.actionsReady() || !this.selectedMeal() || itemId === undefined && !this.canAddRecipe()
      || itemId !== undefined && !this.selectedMeal()!.items.some(item => item.id === itemId && item.type === 'manual')) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { ...this.state.query(), task: 'manual', itemId: itemId ?? null },
      state: { mealPlanParent: { date: this.date(), task: 'meal' } } });
  }
  submitManual(): void {
    const value = this.manual.value(), meal = this.selectedMeal(), revision = this.manual.revision();
    if (!value || !meal || !revision || !this.canSubmitManual()) return;
    const date = this.date(), slot = meal.defaultSlot, id = this.manual.editingId();
    this.structuralPending.set(true);
    this.observe(id !== null ? this.core.updateManual(id, value, revision)
      : this.withSavedTarget(meal, date, revision, (target, base) => this.core.addManual(date, { meal: target.isVirtual ? { defaultSlot: slot! } : { mealId: target.id! }, manualItem: value }, base)), result => {
      this.structuralPending.set(false);
      if (result.outcome === 'confirmed') {
        this.manual.clear();
        if (meal.isVirtual && slot !== null && result.createdMealId !== null) {
          this.sessionSlots.consume(date, slot, result.createdMealId);
          this.state.rememberMaterialization(date, slot, result.createdMealId); this.drafts.rekey('meal:' + result.createdMealId);
          this.state.selection.set({ kind: 'saved', mealId: result.createdMealId });
        }
        if (result.revision) this.drafts.revision.set(result.revision);
        if (!this.deciding) this.back();
      } else {
        this.fail(result); this.manual.blocked.set(true); this.manual.error.set(this.drafts.error()); this.manual.errors.set(result.errors ?? {}); this.manual.diagnostic.set(result.traceId ?? null);
      }
    });
  }
  /** A retained suggestion on a saved day uses the existing explicit-meal API.
   * Adopt its ID before the second request, so failure/retry cannot create it twice. */
  private withSavedTarget(meal: PlannerMealDto, date: string, revision: string,
    submit: (target: PlannerMealDto, revision: string) => Observable<PlannerOperationResult>): Observable<PlannerOperationResult> {
    if (!meal.isVirtual || this.savedDay()?.persistence !== 'saved') return submit(meal, revision);
    const generation = this.core.identityGeneration();
    return this.core.createMeal(date, { name: meal.name }, revision).pipe(concatMap(result => {
      if (generation !== this.core.identityGeneration() || result.outcome !== 'confirmed' || !result.revision || result.createdMealId === null) return of(result);
      const id = result.createdMealId;
      this.sessionSlots.consume(date, meal.defaultSlot!, id);
      this.state.rememberMaterialization(date, meal.defaultSlot!, id);
      this.drafts.rekey('meal:' + id); this.drafts.revision.set(result.revision);
      this.state.selection.set({ kind: 'saved', mealId: id });
      if (this.task() === 'manual') {
        // Preserve the entered food if the second request fails or route effects run.
        this.manual.key.set(date + ':meal:' + id + ':new');
        this.manual.revision.set(result.revision);
      }
      if (!this.deciding) this.navigate(true);
      const saved = this.savedDay()?.meals.find(value => value.id === id);
      if (!saved) return of({ ...result, outcome: 'unknownOutcome' as const });
      return submit(saved, result.revision);
    }));
  }
  startOrder(kind: 'meal' | 'item'): void {
    if (!this.actionsReady()) return;
    const parent = kind === 'meal' ? 'day:' + this.date() : 'meal:' + this.selectedMeal()?.id;
    const ids = kind === 'meal' ? this.savedDay()?.persistence === 'saved' ? this.savedDay()!.meals.map(meal => meal.id!) : null
      : this.selectedMeal()?.isVirtual === false ? this.selectedMeal()!.items.map(item => item.id) : null;
    if (!ids) return;
    this.ordering.parent.set(parent); this.ordering.ids.set(ids); this.ordering.revision.set(this.snapshot()?.observedRevision ?? null);
  }
  cancelOrder(): void { if (!this.structuralPending()) this.ordering.clear(); }
  reorder(kind: 'meal' | 'item', move: { from: number; to: number }): void {
    if (!this.actionsReady()) { this.ordering.clear(); return; }
    const current = kind === 'meal' ? this.savedDay()?.meals.map(meal => meal.id!) ?? [] : this.selectedMeal()?.items.map(item => item.id) ?? [];
    if (!this.ordering.ids()) this.startOrder(kind);
    const ids = this.ordering.ids(), revision = this.ordering.revision();
    if (!ids || !revision || revision !== this.snapshot()?.observedRevision || ids.join(',') !== current.join(',')) {
      this.ordering.clear(); this.drafts.fail('conflict', 'Meal membership changed. Refresh and review before moving anything.'); return;
    }
    const next = movedIds(ids, move.from, move.to), id = ids[move.from];
    if (!next || id === undefined) { this.ordering.clear(); return; }
    this.ordering.ids.set(next); this.structuralPending.set(true);
    this.observe(kind === 'meal' ? this.core.reorderMeals(this.date(), next, revision) : this.core.reorderItems(this.selectedMeal()!.id!, next, revision), result => {
      this.structuralPending.set(false); this.ordering.settled(kind, id, result.outcome === 'confirmed' ? move.to : move.from, ids.length, result.outcome === 'confirmed');
      if (result.outcome !== 'confirmed') this.fail(result);
    });
  }
  async openCopy(mode: CopyMode): Promise<void> {
    const generation = this.core.identityGeneration();
    if (this.copyDialog || !await this.canLeave() || !this.entered || generation !== this.core.identityGeneration() || this.pending() || this.drafts.blocked()) return;
    this.copy.begin(mode, mode === 'week' ? this.week().from : this.date());
    const dialog = this.dialogs.open<CopyDayDialogComponent>(mode === 'day' ? CopyDayDialogComponent : CopyWeekDialogComponent,
      { data: { view: this.copyView }, width: '42rem', maxWidth: 'calc(100vw - 1rem)', ariaLabel: mode === 'day' ? 'Copy day' : 'Copy week', restoreFocus: true });
    this.copyDialog = dialog;
    dialog.componentInstance.destinationChanged.subscribe(date => { this.copy.setDestination(date); this.core.endCopyReview(); });
    dialog.componentInstance.acknowledge.subscribe(value => this.copy.confirmed.set(value));
    dialog.componentInstance.inspect.subscribe(() => this.reviewCopy());
    dialog.componentInstance.confirm.subscribe(() => this.confirmCopy());
    dialog.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.copyDialog = null; this.copy.clear(); this.core.endCopyReview();
      if (this.entered && this.snapshot()?.freshness === 'stale') this.refresh();
    });
  }
  reviewCopy(): void {
    if (this.structuralPending()) return;
    const source = copyRange(this.copy.source(), this.copy.mode()), destination = copyRange(this.copy.destination(), this.copy.mode());
    const sequence = this.copy.nextReview();
    if (!source || !destination || source.from === destination.from) { this.copy.message.set(this.copy.mode() === 'week' ? 'Choose a different Monday with seven valid dates.' : 'Choose a different valid destination date.'); return; }
    const generation = this.core.identityGeneration();
    this.core.reviewCopyRanges(source, destination).pipe(takeUntil(this.exit$), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: matched => {
        if (!this.copy.current(sequence) || generation !== this.core.identityGeneration()) return;
        const revision = this.core.revision();
        if (matched && revision && this.core.resumeAfterReview(source.from + ':' + source.through, revision)) {
          this.copy.reviewedRevision.set(revision); this.drafts.clear();
        } else this.copy.message.set('Source or destination changed. Review both again before copying.');
      }, error: () => { if (this.copy.current(sequence)) this.copy.message.set('Could not review the source and destination. No copy was submitted. Review again when the service is available.'); },
    });
  }
  confirmCopy(): void {
    const view = this.copyView(), revision = this.copy.reviewedRevision();
    if (!revision || !view.ready || view.pending || view.requiresReplacement && !view.confirmed || this.pending()) return;
    const mode = this.copy.mode(), source = this.copy.source(), destination = this.copy.destination();
    this.structuralPending.set(true); if (this.copyDialog) this.copyDialog.disableClose = true;
    const request = mode === 'day' ? this.core.copyDay({ sourceDate: source, destinationDate: destination, replaceExisting: view.requiresReplacement && view.confirmed }, revision)
      : this.core.copyWeek({ sourceMonday: source, destinationMonday: destination, replaceExisting: view.requiresReplacement && view.confirmed }, revision);
    this.observe(request, result => {
      this.structuralPending.set(false); if (this.copyDialog) this.copyDialog.disableClose = false;
      if (result.outcome === 'confirmed') {
        const range = copyRange(destination, mode);
        if (range) {
          const dates: string[] = [];
          for (let date: string | null = range.from; date && date <= range.through; date = shiftCalendarDate(date, 1)) dates.push(date);
          this.sessionSlots.forget(dates);
        }
        this.drafts.clear(); this.copyDialog?.close(); if (!this.deciding) this.jump(destination);
      }
      else {
        this.fail(result); // Keep reconciliation visible and writes disabled even if the dialog is dismissed.
        this.copy.invalidate();
        this.copy.message.set(result.outcome === 'unknownOutcome' ? 'Copy outcome unknown. Review the saved source and destination before another explicit attempt.'
          : result.code === 'source_recipe_unavailable' ? 'A source recipe is unavailable. Nothing was copied. Review the source before another attempt.'
          : 'Copy was not confirmed. Review fresh source and destination content and confirm again.');
      }
    });
  }
  confirmReview(): void {
    const revision = this.lastReadRevision(), meal = this.selectedMeal();
    if (!this.canReview() || !revision || !this.core.resumeAfterReview(this.rangeKey(), revision)) return;
    if (meal) this.drafts.reviewed(revision, meal); else this.drafts.clear();
    if (this.manual.key()) { this.manual.revision.set(revision); this.manual.blocked.set(false); this.manual.error.set(null); this.manual.diagnostic.set(null); this.manual.errors.set({}); }
  }
  async canLeave(nextUrl?: string): Promise<boolean> {
    if (this.deciding) return false;
    // Replacing a just-created slot's URL with its confirmed ID does not leave
    // the logical task. Do not let that internal navigation wait on the second
    // request and suppress its eventual return to the editor.
    if (nextUrl && this.selectedMeal()?.id != null) {
      const tree = this.router.parseUrl(nextUrl), params = tree.queryParams;
      const path = tree.root.children['primary']?.segments.map(segment => segment.path).join('/');
      if (path === 'meal-plan/planner'
        && ['date', 'task', 'mealId', 'defaultSlot', 'itemId'].every(key => String(params[key] ?? '') === String((this.state.query() as Record<string, unknown>)[key] ?? ''))) return true;
    }
    if (nextUrl && this.structuralPending()) {
      // An already-sent explicit action settles before route consent. Its success
      // callback must not navigate to its parent over the user's chosen target.
      this.deciding = true;
      try { await this.core.waitUntilSettled(); } finally { this.deciding = false; }
    }
    // Summary links may change only the fragment. They must focus a field,
    // not ask the user to discard the very form they are correcting.
    if (nextUrl && this.task() === 'manual') {
      const tree = this.router.parseUrl(nextUrl), params = tree.queryParams;
      if (tree.root.children['primary']?.segments.map(segment => segment.path).join('/') === 'meal-plan/planner'
        && ['date', 'task', 'mealId', 'defaultSlot', 'itemId'].every(key => String(params[key] ?? '') === String((this.state.query() as Record<string, unknown>)[key] ?? ''))) return true;
    }
    if (this.copyDialog && !this.structuralPending()) this.copyDialog.close();
    if (this.manual.key() && (this.manual.form.dirty || this.manual.blocked())) {
      if (this.deciding) return false;
      this.deciding = true;
      try {
        const choice = await firstValueFrom(this.dialogs.open(PlannerDecisionDialog, { data: {
          title: 'Leave manual food?', message: 'Your manual food draft has not been saved. Stay to complete it or discard only unsent values.',
        } }).afterClosed());
        if (choice !== 'discard') return false;
        await this.core.waitUntilSettled();
        if (this.manual.blocked() && this.drafts.status() === 'unknownOutcome' && !this.canReview()) { this.refresh(); return false; }
        this.manual.clear(); this.drafts.clear();
      } finally { this.deciding = false; }
    }
    // Own materialization only replaces identity, not the active editor/draft.
    if (nextUrl && this.selectedMeal()?.id !== null && this.task() === 'meal') {
      const tree = this.router.parseUrl(nextUrl), params = tree.queryParams;
      const path = tree.root.children['primary']?.segments.map(segment => segment.path).join('/');
      if (path === 'meal-plan/planner' && !params['defaultSlot'] && params['date'] === this.date()
        && params['task'] === 'meal' && Number(params['mealId']) === this.selectedMeal()?.id) return true;
    }
    if (this.deciding) return false;
    this.deciding = true;
    try {
      if (this.drafts.dirty() || this.drafts.blocked()) {
        const dialog = this.dialogs.open(PlannerDecisionDialog, { data: {
          title: 'Leave this meal?', message: 'Unsent changes stay here unless you save or discard them. A request already sent cannot be undone.',
          save: this.drafts.valid() && !this.drafts.blocked(),
        } });
        // Latch intent before the close animation: an HTTP acknowledgement can
        // arrive while the dialog is closing and must not resurrect discarded edits.
        dialog.beforeClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(choice => {
          if (choice === 'save') this.navigationSaving = true;
          if (choice === 'discard') {
            this.discarding = true;
            const meal = this.selectedMeal();
            if (meal?.id) this.core.cancelUnsent('meal:' + meal.id);
            for (const id of Object.keys(this.drafts.quantities())) this.core.cancelUnsent('item:' + id);
          }
        });
        const choice = await firstValueFrom(dialog.afterClosed());
        if (!choice || choice === 'stay') return false;
        if (choice === 'save') this.flush();
        else {
          this.discarding = true;
          const meal = this.selectedMeal();
          if (meal?.id !== null && meal?.id !== undefined) this.core.cancelUnsent('meal:' + meal.id);
          for (const id of Object.keys(this.drafts.quantities())) this.core.cancelUnsent('item:' + id);
        }
        await this.core.waitUntilSettled();
        if (this.drafts.status() === 'unknownOutcome' && !this.canReview()) { this.refresh(); return false; }
        if (choice === 'save' && (this.drafts.blocked() || this.drafts.dirty())) return false;
        if (choice === 'discard') this.drafts.clear();
      } else {
        await this.core.waitUntilSettled();
        if (this.drafts.blocked()) return false;
      }
      return true;
    } finally { this.deciding = false; this.discarding = false; this.navigationSaving = false; }
  }
  leave(): void { this.exit$.next(); this.entered = false; this.drafts.clear(); this.manual.clear(); this.ordering.reset(); this.copyDialog?.close(); this.copy.clear(); this.core.endCopyReview(); this.picker.clear(); this.pickerState.clear(); this.state.clear(); }
}

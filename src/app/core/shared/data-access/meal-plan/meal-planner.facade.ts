import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, catchError, concatMap, defer, finalize, from, map, mergeMap, of, shareReplay, switchMap, take, takeUntil, tap, throwError, timeout } from 'rxjs';
import { MealPlannerApi } from './meal-planner.api';
import { MealPlannerStore, mealPlannerRangeKey } from './meal-planner.store';
import { MealPlanContextStore } from './meal-plan-context.store';
import { MealPlanMutationCoordinator } from './meal-plan-mutation-coordinator';
import { MealPlanSyncService } from './meal-plan-sync.service';
import { MealPlannerRangeDto } from './meal-plan.model';
import { toApiErrorMessage } from '../generic-template/api-error-message';
import { AddManualItemRequest, AddRecipeItemRequest, CopyDayRequest, CopyWeekRequest, CreateMealRequest, ManualItemRequest, MealPlanMutationKind, PlannerMutationDto, PlannerOperationResult } from './meal-plan-mutation.model';
/** Confirmed planner reads and coordinated writes; no UI selection or nutrient math. */
@Injectable({ providedIn: 'root' })
export class MealPlannerFacade {
    private readonly api = inject(MealPlannerApi);
    private readonly store = inject(MealPlannerStore);
    private readonly context = inject(MealPlanContextStore);
    private readonly lane = inject(MealPlanMutationCoordinator);
    private readonly sync = inject(MealPlanSyncService);
    private readonly reads = new Map<string, Observable<MealPlannerRangeDto>>();
    readonly pending = this.lane.pending;
    readonly paused = this.lane.paused;
    readonly mutationStatus = this.lane.status;
    readonly lastResult = this.lane.lastResult;
    readonly settings = this.context.settings;
    readonly revision = this.context.revision;
    readonly identityGeneration = this.context.identityGeneration;
    readonly reset$ = this.context.reset$;
    constructor() { this.context.reset$.subscribe(() => this.reads.clear()); }
    range(key: string) { return this.store.range(key); }
    activate(from: string, through: string): void { this.store.setRole('active', mealPlannerRangeKey(from, through)); }
    createMeal(date: string, request: CreateMealRequest, revision: string): Observable<PlannerOperationResult> {
        const body = { ...request };
        return this.command('createMeal', revision, 'day:' + date, 'structural',
            base => this.api.createMeal(date, body, base), date, [], [], 'createMeal:' + date);
    }
    renameMeal(id: number, name: string, revision: string): Observable<PlannerOperationResult> {
        return this.command('renameMeal', revision, 'meal:' + id, 'scalar',
            base => this.api.renameMeal(id, { name }, base), undefined, ['meal:' + id]);
    }
    deleteMeal(id: number, itemIds: readonly number[], revision: string): Observable<PlannerOperationResult> {
        return this.command('deleteMeal', revision, 'meal:' + id, 'structural',
            base => this.api.deleteMeal(id, base), undefined, ['meal:' + id],
            ['meal:' + id, ...itemIds.map(item => 'item:' + item)]);
    }
    addRecipe(date: string, request: AddRecipeItemRequest, revision: string): Observable<PlannerOperationResult> {
        const body = { ...request, meal: { ...request.meal } };
        const parent = 'mealId' in body.meal ? 'meal:' + body.meal.mealId : 'slot:' + date + ':' + body.meal.defaultSlot;
        return this.command('addRecipeItem', revision, parent, 'structural',
            base => this.api.addRecipeItem(date, body, base), date, [parent], [],
            'addRecipe:' + parent + ':' + body.recipeId, 'defaultSlot' in body.meal);
    }
    setRecipeQuantity(id: number, quantity: number, revision: string): Observable<PlannerOperationResult> {
        return this.command('setRecipeQuantity', revision, 'item:' + id, 'scalar',
            base => this.api.setRecipeQuantity(id, { quantity }, base), undefined, ['item:' + id]);
    }
    removeItem(id: number, revision: string): Observable<PlannerOperationResult> {
        return this.command('deleteItem', revision, 'item:' + id, 'structural',
            base => this.api.deleteItem(id, base), undefined, ['item:' + id], ['item:' + id]);
    }
    addManual(date: string, request: AddManualItemRequest, revision: string): Observable<PlannerOperationResult> {
        const body = { meal: { ...request.meal }, manualItem: { ...request.manualItem } };
        const parent = 'mealId' in body.meal ? 'meal:' + body.meal.mealId : 'slot:' + date + ':' + body.meal.defaultSlot;
        return this.command('addManualItem', revision, parent, 'structural', base => this.api.addManualItem(date, body, base),
            date, [parent], [], 'addManual:' + parent, 'defaultSlot' in body.meal);
    }
    updateManual(id: number, request: ManualItemRequest, revision: string): Observable<PlannerOperationResult> {
        const body = { ...request };
        return this.command('updateManualItem', revision, 'item:' + id, 'structural', base => this.api.updateManualItem(id, body, base), undefined, ['item:' + id]);
    }
    reorderMeals(date: string, orderedIds: readonly number[], revision: string): Observable<PlannerOperationResult> {
        const body = { orderedIds: [...orderedIds] };
        return this.command('reorderMeals', revision, 'day:' + date, 'structural', base => this.api.reorderMeals(date, body, base), date);
    }
    reorderItems(id: number, orderedIds: readonly number[], revision: string): Observable<PlannerOperationResult> {
        const body = { orderedIds: [...orderedIds] };
        return this.command('reorderItems', revision, 'meal:' + id, 'structural', base => this.api.reorderItems(id, body, base), undefined, ['meal:' + id]);
    }
    copyDay(request: CopyDayRequest, revision: string): Observable<PlannerOperationResult> {
        const body = { ...request };
        return this.command('copyDay', revision, 'copy', 'structural', base => this.api.copyDay(body, base),
            undefined, [], [], 'copy', false, [body.destinationDate]);
    }
    copyWeek(request: CopyWeekRequest, revision: string): Observable<PlannerOperationResult> {
        const body = { ...request }, dates = this.copyDates(body.destinationMonday);
        return this.command('copyWeek', revision, 'copy', 'structural', base => this.api.copyWeek(body, base),
            undefined, [], [], 'copy', false, dates);
    }
    private copyDates(monday: string): string[] {
        const date = new Date(monday + 'T12:00:00Z');
        return Array.from({ length: 7 }, (_, index) => { if (index) date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); });
    }
    /** Pin only the two bounded Core snapshots, never a feature-owned copy graph. */
    reviewCopyRanges(source: { from: string; through: string }, destination: { from: string; through: string }): Observable<boolean> {
        this.store.setRole('copySource', mealPlannerRangeKey(source.from, source.through));
        this.store.setRole('copyDestination', mealPlannerRangeKey(destination.from, destination.through));
        const load = () => this.loadRange(source.from, source.through).pipe(concatMap(() => this.loadRange(destination.from, destination.through)));
        const matches = () => [source, destination].every(value => {
            const snapshot = this.range(mealPlannerRangeKey(value.from, value.through));
            return snapshot?.freshness === 'fresh' && snapshot.request.status === 'success' && snapshot.observedRevision === this.revision();
        });
        return from(this.waitUntilSettled()).pipe(concatMap(() => load()),
            concatMap(() => matches() ? of(true) : from(Promise.resolve()).pipe(concatMap(() => load()), map(matches))), takeUntil(this.context.reset$));
    }
    endCopyReview(): void { this.store.setRole('copySource', null); this.store.setRole('copyDestination', null); }
    waitUntilSettled(): Promise<void> { return this.lane.waitUntilSettled(); }
    cancelUnsent(resourceKey: string): void { this.lane.cancelUnsent(resourceKey); }
    resumeAfterReview(key: string, revision: string): boolean {
        const range = this.store.range(key);
        if (range?.freshness !== 'fresh' || range.request.status !== 'success'
            || range.observedRevision !== revision || this.context.revision() !== revision
            || this.lane.state().activeOperationId !== null) return false;
        this.lane.clearPauseAfterReconciliation();
        return true;
    }
    private command(kind: MealPlanMutationKind, expectedRevision: string, resourceKey: string,
        mode: 'scalar' | 'structural', execute: (revision: string) => Observable<PlannerMutationDto>,
        date?: string, dependsOn: readonly string[] = [], deletesResourceKeys: readonly string[] = [], dedupeKey?: string,
        requiresCreatedMealId = false, affectedDates?: readonly string[]): Observable<PlannerOperationResult> {
        let receipt: PlannerMutationDto | null = null;
        let problem: Pick<PlannerOperationResult, 'traceId' | 'errors'> = {};
        return this.lane.enqueue({
            context: { kind, expectedRevision, ...(date ? { date } : {}) }, mode, resourceKey, dependsOn, deletesResourceKeys,
            ...(mode === 'scalar' ? { coalesceKey: kind + ':' + resourceKey } : { dedupeKey: dedupeKey ?? kind + ':' + resourceKey }),
            execute: revision => execute(revision).pipe(timeout(30000), take(1), tap(value => {
                if (affectedDates && (value.days.length !== affectedDates.length || affectedDates.some(date => !value.days.some(day => day.date === date)))
                    || (kind === 'createMeal' || kind === 'addRecipeItem' || kind === 'addManualItem') && (!date || !value.days.some(day => day.date === date))
                    || (kind === 'createMeal' || requiresCreatedMealId) && (!Number.isInteger(value.createdMealId) || (value.createdMealId ?? 0) <= 0
                        || !value.days.some(day => day.date === date && day.meals.some(meal => meal.id === value.createdMealId)))
                    || (kind === 'addRecipeItem' || kind === 'addManualItem') && (!Number.isInteger(value.createdItemId) || (value.createdItemId ?? 0) <= 0
                        || !value.days.some(day => day.date === date && day.meals.some(meal => (!requiresCreatedMealId || meal.id === value.createdMealId)
                            && meal.items.some(item => item.id === value.createdItemId))))) {
                    throw new Error('The create response omitted its confirmed resource. Inspect the saved day.');
                }
                receipt = value;
            }), catchError(error => {
                const body = error?.error;
                const errors: Record<string, readonly string[]> = {};
                if (body && typeof body.errors === 'object' && body.errors !== null) {
                    for (const [field, messages] of Object.entries(body.errors)) {
                        if (Array.isArray(messages) && messages.every(message => typeof message === 'string')) errors[field] = messages;
                    }
                }
                problem = { errors, ...(typeof body?.traceId === 'string' ? { traceId: body.traceId } : {}) };
                return throwError(() => error);
            })),
        }).pipe(map(result => ({
            ...result, ...problem,
            createdMealId: result.outcome === 'confirmed' ? receipt?.createdMealId ?? null : null,
            createdItemId: result.outcome === 'confirmed' ? receipt?.createdItemId ?? null : null,
        })));
    }
    loadRange(fromDate: string, through: string): Observable<MealPlannerRangeDto> {
        const key = mealPlannerRangeKey(fromDate, through);
        return defer(() => {
            const existing = this.reads.get(key);
            if (existing)
                return existing;
            let shared: Observable<MealPlannerRangeDto>;
            const load = () => {
                const token = this.store.beginLoad(fromDate, through, this.context.readEpoch());
                if (!token)
                    return EMPTY;
                return this.api.getRange(fromDate, through).pipe(timeout(10000), take(1), mergeMap(response => {
                    if (response.from !== fromDate || response.through !== through || !response.days.length
                        || response.days[0]?.date !== fromDate || response.days[response.days.length - 1]?.date !== through) {
                        throw new Error('The planner returned an incomplete range. Refresh to try again.');
                    }
                    const expected: string[] = [];
                    const cursor = new Date(fromDate + 'T12:00:00Z');
                    while (expected.length < 7 && cursor.toISOString().slice(0, 10) <= through) {
                        expected.push(cursor.toISOString().slice(0, 10));
                        cursor.setUTCDate(cursor.getUTCDate() + 1);
                    }
                    if (response.days.length !== expected.length || response.days.some((day, index) => day.date !== expected[index])) {
                        throw new Error('The planner returned an incomplete range. Refresh to try again.');
                    }
                    if (this.sync.observeRead({ kind: 'planner', token, response }))
                        return of(response);
                    const snapshot = this.store.range(key);
                    if (token.identityGeneration === this.store.identityGeneration() && snapshot?.requestSequence === token.requestSequence) {
                        this.store.invalidate(key);
                        const failure = this.store.beginLoad(fromDate, through, this.context.readEpoch());
                        if (failure)
                            this.store.failLoad(failure, 'The planner context changed. Refresh the selected week.', this.context.readEpoch());
                    }
                    return EMPTY;
                }), catchError((error: unknown) => {
                    const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : undefined;
                    this.store.failLoad(token, status === 404 || status === 503
                        ? 'The planner service is unavailable. Saved data has not been changed. Try again when the backend is available.'
                        : toApiErrorMessage(error), this.context.readEpoch(), status);
                    return throwError(() => error);
                }));
            };
            shared = defer(() => this.pending() && !this.lane.paused() ? from(this.lane.waitUntilIdle()).pipe(switchMap(load)) : load()).pipe(takeUntil(this.context.reset$), finalize(() => { if (this.reads.get(key) === shared)
                this.reads.delete(key); }), shareReplay({ bufferSize: 1, refCount: false }));
            this.reads.set(key, shared);
            return shared;
        });
    }
}

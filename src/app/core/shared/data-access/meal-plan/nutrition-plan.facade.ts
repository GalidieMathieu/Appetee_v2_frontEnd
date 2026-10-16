import { Injectable, computed, inject } from '@angular/core';
import { EMPTY, Observable, catchError, defer, finalize, from, map, mergeMap, of, shareReplay, switchMap, takeUntil, throwError, timeout } from 'rxjs';
import { toApiErrorMessage } from '../generic-template/api-error-message';
import { MealPlanContextStore } from './meal-plan-context.store';
import { MealPlanMutationCoordinator } from './meal-plan-mutation-coordinator';
import { MealPlanMutationKind, MealPlanOperationResult } from './meal-plan-mutation.model';
import { MealPlanSyncService } from './meal-plan-sync.service';
import { NutritionPlanApi } from './nutrition-plan.api';
import { CreateNutritionPlanRequest, NutritionPlanListDto, NutritionPlanMutationDto } from './nutrition-plan.model';
import { NutritionPlansStore } from './nutrition-plans.store';
import { NutritionPlanDetailsStore } from './nutrition-plan-details.store';
import { NutritionCalculationRequest, NutritionCalculationDto, NutritionPlanDetailDto, UpdateNutritionPlanRequest } from './nutrition-plan.model';
export interface NutritionPlanOperationResult extends MealPlanOperationResult {
    readonly traceId?: string;
    readonly errors?: Readonly<Record<string, readonly string[]>>;
}
/** Saved plan use cases. Summary reads never hydrate the complete detail cache. */
@Injectable({ providedIn: 'root' })
export class NutritionPlanFacade {
    private readonly api = inject(NutritionPlanApi);
    private readonly store = inject(NutritionPlansStore);
    private readonly context = inject(MealPlanContextStore);
    private readonly coordinator = inject(MealPlanMutationCoordinator);
    private readonly sync = inject(MealPlanSyncService);
    private inFlight: Observable<NutritionPlanListDto> | null = null;
    private readonly details = inject(NutritionPlanDetailsStore);
    private readonly detailReads = new Map<number, Observable<NutritionPlanDetailDto>>();
    readonly plans = this.store.plans;
    readonly loaded = this.store.loaded;
    readonly stale = this.store.stale;
    readonly request = this.store.request;
    readonly revision = this.store.observedRevision;
    readonly settings = this.context.settings;
    readonly pending = this.coordinator.pending;
    readonly paused = this.coordinator.paused;
    readonly canWrite = computed(() => this.loaded() && !this.stale()
        && this.revision() !== null && this.revision() === this.context.revision()
        && !this.pending() && !this.paused());
    constructor() {
        this.context.reset$.subscribe(() => { this.inFlight = null; this.detailReads.clear(); });
    }
    loadList(): Observable<NutritionPlanListDto> {
        return defer(() => {
            if (this.inFlight !== null)
                return this.inFlight;
            let shared: Observable<NutritionPlanListDto>;
            const load = () => {
                const token = this.store.beginLoad(this.context.readEpoch());
                if (token === null)
                    return EMPTY;
                return this.api.getPlans().pipe(timeout(10000), mergeMap(response => {
                    if (this.sync.observeRead({ kind: 'plans', token, response }))
                        return of(response);
                    // A discarded pre-write response must not strand this query in Loading.
                    // Never clear a newer request's state or accept the old payload.
                    const state = this.store.state();
                    if (state.identityGeneration === token.identityGeneration
                        && state.requestSequence === token.requestSequence && state.request.status === 'loading') {
                        this.store.invalidate();
                        const failed = this.store.beginLoad(this.context.readEpoch());
                        if (failed)
                            this.store.failLoad(failed, 'Plan context changed while loading. Refresh the plans.', this.context.readEpoch());
                    }
                    return EMPTY;
                }), catchError((error: unknown) => {
                    this.store.failLoad(token, toApiErrorMessage(error), this.context.readEpoch(), typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
                        ? error.status : undefined);
                    return throwError(() => error);
                }));
            };
            shared = defer(() => this.pending()
                ? from(this.coordinator.waitUntilIdle()).pipe(switchMap(load)) : load()).pipe(takeUntil(this.context.reset$), finalize(() => { if (this.inFlight === shared)
                this.inFlight = null; }), shareReplay({ bufferSize: 1, refCount: false }));
            this.inFlight = shared;
            return shared;
        });
    }
    duplicate(planId: number, expectedRevision: string): Observable<NutritionPlanOperationResult> {
        return this.command('duplicateNutritionPlan', planId, expectedRevision, revision => this.api.duplicatePlan(planId, revision));
    }
    create(request: CreateNutritionPlanRequest, expectedRevision: string): Observable<NutritionPlanOperationResult> {
        return this.command('createNutritionPlan', null, expectedRevision, revision => this.api.createPlan(request, revision));
    }
    detail(id: number) { return this.details.get(id); }
    detailRequest(id: number) { return this.details.requestState(id); }
    detailFresh(id: number): boolean {
        const record = this.detail(id);
        return record !== null && record.revision === this.context.revision()
            && this.details.requestState(id).status === 'success';
    }
    loadDetail(id: number): Observable<NutritionPlanDetailDto> {
        return defer(() => {
            const existing = this.detailReads.get(id);
            if (existing)
                return existing;
            let shared: Observable<NutritionPlanDetailDto>;
            const load = () => {
                const token = this.details.beginLoad(id, this.context.readEpoch());
                if (!token)
                    return EMPTY;
                return this.api.getPlan(id).pipe(timeout(10000), mergeMap(response => {
                    if (response.plan.id !== id)
                        throw new Error('This plan is unavailable.');
                    if (this.sync.observeRead({ kind: 'planDetail', token, response }))
                        return of(response);
                    if (this.details.isRequestCurrent(id, token.identityGeneration, token.invalidationVersion)
                        && this.details.requestState(id).status === 'loading') {
                        this.details.invalidate(id);
                        const failed = this.details.beginLoad(id, this.context.readEpoch());
                        if (failed)
                            this.details.failLoad(id, failed, 'Plan context changed while loading. Refresh the saved plan.', this.context.readEpoch());
                    }
                    return EMPTY;
                }), catchError((error: unknown) => {
                    this.details.failLoad(id, token, toApiErrorMessage(error), this.context.readEpoch(), typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : undefined);
                    return throwError(() => error);
                }));
            };
            shared = defer(() => this.pending() && !this.paused()
                ? from(this.coordinator.waitUntilIdle()).pipe(switchMap(load)) : load()).pipe(takeUntil(this.context.reset$), finalize(() => {
                if (this.detailReads.get(id) === shared)
                    this.detailReads.delete(id);
            }), shareReplay({ bufferSize: 1, refCount: false }));
            this.detailReads.set(id, shared);
            return shared;
        });
    }
    preview(request: NutritionCalculationRequest): Observable<NutritionCalculationDto> {
        return this.api.previewCalculation(request).pipe(timeout(10000), takeUntil(this.context.reset$));
    }
    update(id: number, request: UpdateNutritionPlanRequest, revision: string): Observable<NutritionPlanOperationResult> {
        return this.command('updateNutritionPlan', id, revision, base => this.api.updatePlan(id, request, base));
    }
    resumeDetailAfterReview(id: number, revision: string): boolean {
        if (!this.detailFresh(id) || this.detail(id)?.revision !== revision
            || this.coordinator.state().activeOperationId !== null)
            return false;
        this.coordinator.clearPauseAfterReconciliation();
        return true;
    }
    delete(planId: number, expectedRevision: string): Observable<NutritionPlanOperationResult> {
        return this.command('deleteNutritionPlan', planId, expectedRevision, revision => this.api.deletePlan(planId, revision));
    }
    setCurrent(planId: number, expectedRevision: string): Observable<NutritionPlanOperationResult> {
        return this.command('setCurrentNutritionPlan', planId, expectedRevision, revision => this.api.setCurrentPlan({ nutritionPlanId: planId }, revision));
    }
    /** A fresh list can be explicitly reviewed; it never automatically replays a prior command. */
    resumeAfterReview(revision: string): boolean {
        if (!this.loaded() || this.stale() || this.revision() !== revision
            || this.context.revision() !== revision || this.coordinator.state().activeOperationId !== null)
            return false;
        this.coordinator.clearPauseAfterReconciliation();
        return true;
    }
    private command(kind: MealPlanMutationKind, planId: number | null, expectedRevision: string, execute: (revision: string) => Observable<NutritionPlanMutationDto>): Observable<NutritionPlanOperationResult> {
        let problem: Pick<NutritionPlanOperationResult, 'traceId' | 'errors'> = {};
        return this.coordinator.enqueue({
            context: { kind, expectedRevision }, mode: 'structural',
            resourceKey: planId === null ? 'nutrition-plan-create' : `plan:${planId}`,
            dedupeKey: `${kind}:${planId ?? 'new'}`, dependsOn: planId === null ? [] : [`plan:${planId}`],
            ...(kind === 'deleteNutritionPlan' ? { deletesResourceKeys: [`plan:${planId}`] } : {}),
            execute: revision => execute(revision).pipe(catchError((error: unknown) => {
                if (typeof error === 'object' && error !== null && 'error' in error
                    && typeof error.error === 'object' && error.error !== null) {
                    const body = error.error as {
                        traceId?: unknown;
                        errors?: unknown;
                    };
                    const errors: Record<string, readonly string[]> = {};
                    if (typeof body.errors === 'object' && body.errors !== null) {
                        for (const [path, messages] of Object.entries(body.errors)) {
                            if (Array.isArray(messages) && messages.every(message => typeof message === 'string'))
                                errors[path] = messages;
                        }
                    }
                    problem = { errors, ...(typeof body.traceId === 'string' ? { traceId: body.traceId } : {}) };
                }
                return throwError(() => error);
            })),
        }).pipe(map(result => ({ ...result, ...problem })));
    }
}

import { Injectable, computed, signal } from '@angular/core';
import { EntityRequestState } from '../generic-template/entity-cache-store';
import { ResettableStore } from '../../utils/resettable-store';
import { MealPlanQueryToken } from './meal-plan-context.store';
import { MealPlanDate, MealPlannerRangeDto } from './meal-plan.model';
import { PlannerMutationDto } from './meal-plan-mutation.model';
export type MealPlannerRangeRole = 'active' | 'copySource' | 'copyDestination';
export type MealPlannerRangeFreshness = 'fresh' | 'stale';
export interface MealPlannerRangeSnapshot {
    readonly queryKey: string;
    readonly from: MealPlanDate;
    readonly through: MealPlanDate;
    readonly data: MealPlannerRangeDto | null;
    readonly observedRevision: string | null;
    readonly freshness: MealPlannerRangeFreshness;
    readonly request: EntityRequestState;
    readonly requestSequence: number;
    readonly invalidationVersion: number;
    readonly lastAccessSequence: number;
}
export interface MealPlannerState {
    readonly rangesByKey: Readonly<Record<string, MealPlannerRangeSnapshot>>;
    readonly activeKey: string | null;
    readonly copySourceKey: string | null;
    readonly copyDestinationKey: string | null;
    readonly identityGeneration: number;
    readonly accessSequence: number;
}
const MAX_RANGE_SNAPSHOTS = 3;
const IDLE_REQUEST: EntityRequestState = { status: 'idle', error: null };
function initialState(identityGeneration = 0): MealPlannerState {
    return {
        rangesByKey: {},
        activeKey: null,
        copySourceKey: null,
        copyDestinationKey: null,
        identityGeneration,
        accessSequence: 0,
    };
}
export function mealPlannerRangeKey(from: MealPlanDate, through: MealPlanDate): string {
    return `${from}:${through}`;
}
/** Root, identity-scoped cache of at most three complete planner range projections. */
@Injectable({ providedIn: 'root' })
export class MealPlannerStore implements ResettableStore {
    private readonly stateSignal = signal<MealPlannerState>(initialState());
    readonly state = this.stateSignal.asReadonly();
    readonly rangesByKey = computed(() => this.stateSignal().rangesByKey);
    readonly activeKey = computed(() => this.stateSignal().activeKey);
    readonly identityGeneration = computed(() => this.stateSignal().identityGeneration);
    range(queryKey: string): MealPlannerRangeSnapshot | null {
        return this.stateSignal().rangesByKey[queryKey] ?? null;
    }
    data(queryKey: string): MealPlannerRangeDto | null {
        return this.range(queryKey)?.data ?? null;
    }
    requestState(queryKey: string): EntityRequestState {
        return this.range(queryKey)?.request ?? IDLE_REQUEST;
    }
    setRole(role: MealPlannerRangeRole, queryKey: string | null): void {
        const field = role === 'active'
            ? 'activeKey'
            : role === 'copySource'
                ? 'copySourceKey'
                : 'copyDestinationKey';
        this.stateSignal.update(state => ({ ...state, [field]: queryKey }));
        if (queryKey !== null)
            this.touch(queryKey);
    }
    beginLoad(from: MealPlanDate, through: MealPlanDate, readEpoch: number): MealPlanQueryToken | null {
        const queryKey = mealPlannerRangeKey(from, through);
        const current = this.range(queryKey);
        if (current?.request.status === 'loading')
            return null;
        if (!current && !this.makeRoomFor(queryKey))
            return null;
        let token: MealPlanQueryToken | null = null;
        this.stateSignal.update(state => {
            const existing = state.rangesByKey[queryKey];
            const requestSequence = (existing?.requestSequence ?? 0) + 1;
            const accessSequence = state.accessSequence + 1;
            const snapshot: MealPlannerRangeSnapshot = {
                queryKey,
                from,
                through,
                data: existing?.data ?? null,
                observedRevision: existing?.observedRevision ?? null,
                freshness: 'stale',
                request: { status: 'loading', error: null },
                requestSequence,
                invalidationVersion: existing?.invalidationVersion ?? 0,
                lastAccessSequence: accessSequence,
            };
            token = {
                identityGeneration: state.identityGeneration,
                queryKey,
                requestSequence,
                readEpoch,
                invalidationVersion: snapshot.invalidationVersion,
            };
            return {
                ...state,
                rangesByKey: { ...state.rangesByKey, [queryKey]: snapshot },
                accessSequence,
            };
        });
        return token;
    }
    acceptRange(token: MealPlanQueryToken, response: MealPlannerRangeDto, currentReadEpoch: number): boolean {
        if (!this.isTokenCurrent(token, currentReadEpoch))
            return false;
        this.stateSignal.update(state => {
            const existing = state.rangesByKey[token.queryKey];
            if (!existing)
                return state;
            return {
                ...state,
                rangesByKey: {
                    ...state.rangesByKey,
                    [token.queryKey]: {
                        ...existing,
                        data: response,
                        observedRevision: response.revision,
                        freshness: 'fresh',
                        request: { status: 'success', error: null },
                    },
                },
            };
        });
        return true;
    }
    failLoad(token: MealPlanQueryToken, message: string, currentReadEpoch: number, httpStatus?: number): boolean {
        if (!this.isTokenCurrent(token, currentReadEpoch))
            return false;
        this.stateSignal.update(state => {
            const existing = state.rangesByKey[token.queryKey];
            if (!existing)
                return state;
            const request: EntityRequestState = httpStatus === undefined
                ? { status: 'error', error: message }
                : { status: 'error', error: message, httpStatus };
            return {
                ...state,
                rangesByKey: {
                    ...state.rangesByKey,
                    [token.queryKey]: { ...existing, request },
                },
            };
        });
        return true;
    }
    invalidate(queryKey: string): void {
        this.stateSignal.update(state => {
            const existing = state.rangesByKey[queryKey];
            if (!existing)
                return state;
            return {
                ...state,
                rangesByKey: {
                    ...state.rangesByKey,
                    [queryKey]: {
                        ...existing,
                        freshness: 'stale',
                        request: existing.request.status === 'loading' ? IDLE_REQUEST : existing.request,
                        invalidationVersion: existing.invalidationVersion + 1,
                    },
                },
            };
        });
    }
    invalidateAll(): void {
        for (const queryKey of Object.keys(this.rangesByKey()))
            this.invalidate(queryKey);
    }
    invalidateOlderThan(revision: string, exceptQueryKey: string | null = null): void {
        for (const snapshot of Object.values(this.rangesByKey())) {
            if (snapshot.queryKey !== exceptQueryKey
                && snapshot.observedRevision !== null
                && compareRevisions(snapshot.observedRevision, revision) < 0) {
                this.invalidate(snapshot.queryKey);
            }
        }
    }
    applyPlannerReceipt(expectedRevision: string, receipt: PlannerMutationDto): void {
        const returnedDays = new Map(receipt.days.map(day => [day.date, day]));
        this.stateSignal.update(state => ({
            ...state,
            rangesByKey: Object.fromEntries(Object.entries(state.rangesByKey).map(([key, snapshot]) => {
                if (snapshot.data === null || snapshot.freshness !== 'fresh')
                    return [key, snapshot];
                if (snapshot.observedRevision !== expectedRevision) {
                    return [key, { ...snapshot, freshness: 'stale' as const }];
                }
                const overlaps = snapshot.data.days.some(day => returnedDays.has(day.date));
                const days = overlaps
                    ? snapshot.data.days.map(day => returnedDays.get(day.date) ?? day)
                    : snapshot.data.days;
                return [key, {
                        ...snapshot,
                        data: { ...snapshot.data, revision: receipt.revision, settings: receipt.settings, days },
                        observedRevision: receipt.revision,
                    }];
            })),
        }));
    }
    rebaseFresh(expectedRevision: string, revision: string): void {
        this.stateSignal.update(state => ({
            ...state,
            rangesByKey: Object.fromEntries(Object.entries(state.rangesByKey).map(([key, snapshot]) => {
                if (snapshot.data === null
                    || snapshot.freshness !== 'fresh'
                    || snapshot.observedRevision !== expectedRevision)
                    return [key, snapshot];
                return [key, {
                        ...snapshot,
                        data: { ...snapshot.data, revision },
                        observedRevision: revision,
                    }];
            })),
        }));
    }
    reset(): void {
        this.stateSignal.update(state => initialState(state.identityGeneration + 1));
    }
    private isTokenCurrent(token: MealPlanQueryToken, currentReadEpoch: number): boolean {
        const state = this.stateSignal();
        const snapshot = state.rangesByKey[token.queryKey];
        return state.identityGeneration === token.identityGeneration
            && token.readEpoch === currentReadEpoch
            && snapshot?.requestSequence === token.requestSequence
            && snapshot.invalidationVersion === token.invalidationVersion;
    }
    private touch(queryKey: string): void {
        this.stateSignal.update(state => {
            const existing = state.rangesByKey[queryKey];
            if (!existing)
                return state;
            const accessSequence = state.accessSequence + 1;
            return {
                ...state,
                rangesByKey: {
                    ...state.rangesByKey,
                    [queryKey]: { ...existing, lastAccessSequence: accessSequence },
                },
                accessSequence,
            };
        });
    }
    private makeRoomFor(queryKey: string): boolean {
        const state = this.stateSignal();
        if (state.rangesByKey[queryKey])
            return true;
        const entries = Object.values(state.rangesByKey);
        if (entries.length < MAX_RANGE_SNAPSHOTS)
            return true;
        const protectedKeys = new Set([
            state.activeKey,
            state.copySourceKey,
            state.copyDestinationKey,
        ].filter((key): key is string => key !== null));
        const evictable = entries
            .filter(snapshot => !protectedKeys.has(snapshot.queryKey))
            .sort((left, right) => left.lastAccessSequence - right.lastAccessSequence)[0];
        if (!evictable)
            return false;
        this.stateSignal.update(current => {
            const { [evictable.queryKey]: _evicted, ...rangesByKey } = current.rangesByKey;
            return { ...current, rangesByKey };
        });
        return true;
    }
}
function compareRevisions(left: string, right: string): number {
    const leftValue = BigInt(left);
    const rightValue = BigInt(right);
    return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

import { Signal, computed, signal } from '@angular/core';

import { ResettableStore } from '../../utils/resettable-store';

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

export interface EntityRequestState {
  readonly status: RequestStatus;
  readonly error: string | null;
}

export interface EntityCacheState<TEntity> {
  readonly entitiesById: Readonly<Record<number, TEntity>>;
  readonly requestById: Readonly<Record<number, EntityRequestState>>;
}

const IDLE_REQUEST: EntityRequestState = { status: 'idle', error: null };

/**
 * Signal-backed, memory-only cache for complete server entities loaded independently by id.
 * Fetching remains a facade responsibility so this class has no HTTP or domain coupling.
 */
export abstract class EntityCacheStore<TEntity extends { id: number }>
  implements ResettableStore {
  private readonly stateSignal = signal<EntityCacheState<TEntity>>({
    entitiesById: {},
    requestById: {},
  });
  private readonly generationSignal = signal(0);

  readonly state = this.stateSignal.asReadonly();
  readonly entitiesById = computed(() => this.stateSignal().entitiesById);
  readonly requestById = computed(() => this.stateSignal().requestById);

  /** Changes on reset so facades can reject responses started for an earlier identity. */
  generation(): number {
    return this.generationSignal();
  }

  get(id: number): TEntity | null {
    return this.stateSignal().entitiesById[id] ?? null;
  }

  has(id: number): boolean {
    return this.get(id) !== null;
  }

  requestState(id: number): EntityRequestState {
    return this.stateSignal().requestById[id] ?? IDLE_REQUEST;
  }

  requestStateFor(id: number): Signal<EntityRequestState> {
    return computed(() => this.stateSignal().requestById[id] ?? IDLE_REQUEST);
  }

  upsert(entity: TEntity): void {
    this.stateSignal.update(state => ({
      entitiesById: { ...state.entitiesById, [entity.id]: entity },
      requestById: {
        ...state.requestById,
        [entity.id]: { status: 'success', error: null },
      },
    }));
  }

  invalidate(id: number): void {
    this.stateSignal.update(state => {
      const { [id]: _entity, ...entitiesById } = state.entitiesById;
      const { [id]: _request, ...requestById } = state.requestById;
      return { entitiesById, requestById };
    });
  }

  setLoading(id: number): void {
    this.setRequestState(id, { status: 'loading', error: null });
  }

  setError(id: number, message: string): void {
    this.setRequestState(id, { status: 'error', error: message });
  }

  reset(): void {
    this.generationSignal.update(value => value + 1);
    this.stateSignal.set({ entitiesById: {}, requestById: {} });
  }

  private setRequestState(id: number, request: EntityRequestState): void {
    this.stateSignal.update(state => ({
      ...state,
      requestById: { ...state.requestById, [id]: request },
    }));
  }
}

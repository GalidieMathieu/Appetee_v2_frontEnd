/**
 * Identity-scoped Favorites query state for one bounded, server-ordered card collection.
 * Generations reject pre-reset responses and freshness versions close mutation/load races.
 */
import { Injectable, computed, signal } from '@angular/core';

import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';
import { ResettableStore } from '@app/core/shared/utils/resettable-store';

export type FavoritesStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface FavoritesState {
  readonly items: readonly RecipeCardDto[];
  readonly status: FavoritesStatus;
  readonly error: string | null;
  readonly stale: boolean;
  readonly generation: number;
  readonly freshnessVersion: number;
}

export interface FavoritesLoadToken {
  readonly generation: number;
  readonly freshnessVersion: number;
}

function initialState(generation = 0, freshnessVersion = 0): FavoritesState {
  return {
    items: [],
    status: 'idle',
    error: null,
    stale: false,
    generation,
    freshnessVersion,
  };
}

@Injectable({ providedIn: 'root' })
export class FavoritesStore implements ResettableStore {
  private readonly stateSignal = signal<FavoritesState>(initialState());

  readonly state = this.stateSignal.asReadonly();
  readonly recipes = computed(() => this.stateSignal().items);
  readonly status = computed(() => this.stateSignal().status);
  readonly isLoading = computed(() => this.stateSignal().status === 'loading');
  readonly isLoaded = computed(() => this.stateSignal().status === 'loaded');
  readonly error = computed(() => this.stateSignal().error);
  readonly stale = computed(() => this.stateSignal().stale);

  /** Starts at most one request and captures the freshness boundary it represents. */
  beginLoad(): FavoritesLoadToken | null {
    const current = this.stateSignal();
    if (current.status === 'loading') return null;

    const generation = current.generation + 1;
    this.stateSignal.set({
      ...current,
      status: 'loading',
      error: null,
      stale: false,
      generation,
    });
    return { generation, freshnessVersion: current.freshnessVersion };
  }

  /** Accepts only the active identity/request and preserves server ordering while de-duplicating. */
  setLoaded(items: readonly RecipeCardDto[], token: FavoritesLoadToken): boolean {
    const current = this.stateSignal();
    if (current.generation !== token.generation) return false;

    const unique = [...new Map(items.map(item => [item.id, item])).values()];
    this.stateSignal.set({
      ...current,
      items: unique,
      status: 'loaded',
      error: null,
      stale: current.freshnessVersion !== token.freshnessVersion,
    });
    return true;
  }

  setError(error: string, token: FavoritesLoadToken): boolean {
    if (this.stateSignal().generation !== token.generation) return false;
    this.stateSignal.update(state => ({ ...state, status: 'error', error }));
    return true;
  }

  /** Applies confirmed unsaves immediately; an in-flight read is additionally made stale. */
  remove(recipeId: number): void {
    this.stateSignal.update(state => {
      const requestWasInFlight = state.status === 'loading';
      return {
        ...state,
        items: state.items.filter(item => item.id !== recipeId),
        stale: requestWasInFlight || state.stale,
        freshnessVersion: requestWasInFlight
          ? state.freshnessVersion + 1
          : state.freshnessVersion,
      };
    });
  }

  /** Invalidates list membership without inventing a partial card for a newly saved recipe. */
  markStale(): void {
    this.stateSignal.update(state => ({
      ...state,
      stale: true,
      freshnessVersion: state.freshnessVersion + 1,
    }));
  }

  /** Clears every user-owned card and invalidates responses from the previous identity. */
  reset(): void {
    const current = this.stateSignal();
    this.stateSignal.set(initialState(
      current.generation + 1,
      current.freshnessVersion + 1
    ));
  }
}

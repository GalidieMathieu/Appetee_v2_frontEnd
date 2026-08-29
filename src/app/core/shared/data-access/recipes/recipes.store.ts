/**
 * Authenticated-session recipe discovery cache with normalized card ordering and request state.
 * Phase 11 retains matching SPA queries and rejects responses from invalidated generations.
 */
import { Injectable, computed, signal } from '@angular/core';

import { EntityRequestState } from '../generic-template/entity-cache-store';
import { ResettableStore } from '../../utils/resettable-store';
import {
  RecipeCardDto,
  RecipeDiscoveryCriteria,
  RecipeDiscoveryPageDto,
} from './recipe.model';

const IDLE_REQUEST: EntityRequestState = { status: 'idle', error: null };

export interface RecipesState {
  readonly criteria: RecipeDiscoveryCriteria;
  readonly queryKey: string | null;
  readonly cardsById: Readonly<Record<number, RecipeCardDto>>;
  readonly orderedIds: readonly number[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly initialRequest: EntityRequestState;
  readonly loadMoreRequest: EntityRequestState;
  readonly generation: number;
}

export interface RecipeDiscoveryContinuation {
  readonly cursor: string;
  readonly generation: number;
}

/** Creates an empty discovery chain while preserving an explicit identity/query generation. */
function initialState(
  generation = 0,
  criteria: RecipeDiscoveryCriteria = {
    search: '',
    ingredientIds: [],
    requireAllIngredients: true,
    badges: [],
    maxTotalMinutes: null,
    maxDifficulty: null,
    savedOnly: false,
  },
  queryKey: string | null = null
): RecipesState {
  return {
    criteria,
    queryKey,
    cardsById: {},
    orderedIds: [],
    nextCursor: null,
    hasMore: false,
    initialRequest: IDLE_REQUEST,
    loadMoreRequest: IDLE_REQUEST,
    generation,
  };
}

@Injectable({ providedIn: 'root' })
export class RecipesStore implements ResettableStore {
  private readonly stateSignal = signal<RecipesState>(initialState());

  readonly state = this.stateSignal.asReadonly();
  readonly criteria = computed(() => this.stateSignal().criteria);
  readonly appliedSearch = computed(() => this.stateSignal().criteria.search);
  readonly appliedIngredientIds = computed(
    () => this.stateSignal().criteria.ingredientIds
  );
  readonly appliedRequireAllIngredients = computed(
    () => this.stateSignal().criteria.requireAllIngredients
  );
  readonly appliedBadges = computed(() => this.stateSignal().criteria.badges);
  readonly appliedMaxTotalMinutes = computed(
    () => this.stateSignal().criteria.maxTotalMinutes
  );
  readonly appliedMaxDifficulty = computed(
    () => this.stateSignal().criteria.maxDifficulty
  );
  readonly appliedSavedOnly = computed(() => this.stateSignal().criteria.savedOnly);
  readonly hasAppliedAdvancedFilters = computed(() => {
    const criteria = this.stateSignal().criteria;
    return criteria.ingredientIds.length > 0
      || criteria.badges.length > 0
      || criteria.maxTotalMinutes !== null
      || criteria.maxDifficulty !== null
      || criteria.savedOnly;
  });
  readonly queryKey = computed(() => this.stateSignal().queryKey);
  readonly cards = computed<readonly RecipeCardDto[]>(() => {
    const state = this.stateSignal();
    return state.orderedIds.flatMap(id => {
      const card = state.cardsById[id];
      return card ? [card] : [];
    });
  });
  readonly nextCursor = computed(() => this.stateSignal().nextCursor);
  readonly hasMore = computed(() => this.stateSignal().hasMore);
  readonly initialRequest = computed(() => this.stateSignal().initialRequest);
  readonly loadMoreRequest = computed(() => this.stateSignal().loadMoreRequest);
  readonly isInitialLoading = computed(() => this.initialRequest().status === 'loading');
  readonly initialError = computed(() => this.initialRequest().error);
  readonly isLoadingMore = computed(() => this.loadMoreRequest().status === 'loading');
  readonly loadMoreError = computed(() => this.loadMoreRequest().error);

  /** Reuses loaded cards only when canonical applied intent matches the cached query key. */
  reuseQuery(criteria: RecipeDiscoveryCriteria, queryKey: string): boolean {
    const current = this.stateSignal();
    if (current.queryKey !== queryKey || current.initialRequest.status === 'idle') return false;

    this.stateSignal.update(state => ({ ...state, criteria }));
    return true;
  }

  /** Replaces the current chain and increments generation so older responses become stale. */
  beginQuery(criteria: RecipeDiscoveryCriteria, queryKey: string): number | null {
    const current = this.stateSignal();
    if (
      current.initialRequest.status === 'loading'
      && current.queryKey === queryKey
    ) {
      return null;
    }

    const generation = current.generation + 1;
    this.stateSignal.set({
      ...initialState(generation, criteria, queryKey),
      initialRequest: { status: 'loading', error: null },
    });
    return generation;
  }

  /** Accepts page one only for the active generation and preserves backend ordering. */
  replacePage(page: RecipeDiscoveryPageDto, generation: number): boolean {
    if (this.stateSignal().generation !== generation) return false;

    const indexed = this.indexCards(page.items);
    this.stateSignal.update(state => ({
      ...state,
      ...indexed,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      initialRequest: { status: 'success', error: null },
      loadMoreRequest: IDLE_REQUEST,
    }));
    return true;
  }

  failInitialRequest(message: string, generation: number): boolean {
    if (this.stateSignal().generation !== generation) return false;

    this.stateSignal.update(state => ({
      ...state,
      initialRequest: { status: 'error', error: message },
    }));
    return true;
  }

  /** Returns one continuation token only when another next-page request cannot compete. */
  beginLoadMoreRequest(): RecipeDiscoveryContinuation | null {
    const state = this.stateSignal();
    if (
      !state.hasMore
      || state.nextCursor === null
      || state.initialRequest.status === 'loading'
      || state.loadMoreRequest.status === 'loading'
    ) {
      return null;
    }

    this.stateSignal.update(current => ({
      ...current,
      loadMoreRequest: { status: 'loading', error: null },
    }));
    return { cursor: state.nextCursor, generation: state.generation };
  }

  /** Appends an active-generation page in server order while defensively de-duplicating IDs. */
  appendPage(page: RecipeDiscoveryPageDto, generation: number): boolean {
    if (this.stateSignal().generation !== generation) return false;

    this.stateSignal.update(state => {
      const cardsById: Record<number, RecipeCardDto> = { ...state.cardsById };
      const orderedIds = [...state.orderedIds];
      const knownIds = new Set(orderedIds);

      for (const card of page.items) {
        cardsById[card.id] = card;
        if (!knownIds.has(card.id)) {
          knownIds.add(card.id);
          orderedIds.push(card.id);
        }
      }

      return {
        ...state,
        cardsById,
        orderedIds,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        loadMoreRequest: { status: 'success', error: null },
      };
    });
    return true;
  }

  failLoadMoreRequest(message: string, generation: number): boolean {
    if (this.stateSignal().generation !== generation) return false;

    this.stateSignal.update(state => ({
      ...state,
      loadMoreRequest: { status: 'error', error: message },
    }));
    return true;
  }

  /** Patches one loaded projection for optimistic favorite synchronization without refetching. */
  updateSaved(recipeId: number, isSaved: boolean): boolean {
    const existing = this.stateSignal().cardsById[recipeId];
    if (!existing) return false;

    this.stateSignal.update(state => ({
      ...state,
      cardsById: {
        ...state.cardsById,
        [recipeId]: { ...existing, isSaved },
      },
    }));
    return true;
  }

  card(recipeId: number): RecipeCardDto | null {
    return this.stateSignal().cardsById[recipeId] ?? null;
  }

  /** Clears all identity-scoped discovery data and invalidates every outstanding response. */
  reset(): void {
    this.stateSignal.update(state => initialState(state.generation + 1));
  }

  private indexCards(cards: readonly RecipeCardDto[]): Pick<
    RecipesState,
    'cardsById' | 'orderedIds'
  > {
    const cardsById: Record<number, RecipeCardDto> = {};
    const orderedIds: number[] = [];

    for (const card of cards) {
      cardsById[card.id] = card;
      if (!orderedIds.includes(card.id)) orderedIds.push(card.id);
    }

    return { cardsById, orderedIds };
  }
}

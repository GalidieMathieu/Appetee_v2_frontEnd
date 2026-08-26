import { Injectable, computed, signal } from '@angular/core';

import { EntityRequestState } from '../generic-template/entity-cache-store';
import { ResettableStore } from '../../utils/resettable-store';
import { RecipeCardDto, RecipeDiscoveryPageDto } from './recipe.model';

const IDLE_REQUEST: EntityRequestState = { status: 'idle', error: null };

export interface RecipesState {
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

function initialState(generation = 0): RecipesState {
  return {
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

  beginInitialRequest(): number | null {
    const current = this.stateSignal();
    if (current.initialRequest.status === 'loading') return null;

    const generation = current.generation + 1;
    this.stateSignal.set({
      ...initialState(generation),
      initialRequest: { status: 'loading', error: null },
    });
    return generation;
  }

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

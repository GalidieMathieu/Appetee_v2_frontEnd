/**
 * Identity-scoped Home composition state for bounded Discover and Favorites card projections.
 * Per-section generations reject stale responses while preserving valid Discover cards on re-entry.
 */
import { Injectable, computed, signal } from '@angular/core';

import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';
import { ResettableStore } from '@app/core/shared/utils/resettable-store';

export type HomeSectionStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface HomeSectionState {
  readonly items: readonly RecipeCardDto[];
  readonly status: HomeSectionStatus;
  readonly error: string | null;
  readonly stale: boolean;
  readonly generation: number;
  readonly freshnessVersion: number;
}

export interface HomeState {
  readonly discover: HomeSectionState;
  readonly favorites: HomeSectionState;
}

export interface HomeLoadToken {
  readonly generation: number;
  readonly freshnessVersion: number;
}

function section(generation = 0, freshnessVersion = 0): HomeSectionState {
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
export class HomeStore implements ResettableStore {
  private readonly stateSignal = signal<HomeState>({
    discover: section(),
    favorites: section(),
  });

  readonly state = this.stateSignal.asReadonly();
  readonly discoverRecipes = computed(() => this.stateSignal().discover.items);
  readonly favoriteRecipes = computed(() => this.stateSignal().favorites.items);
  readonly isDiscoverLoading = computed(() => this.stateSignal().discover.status === 'loading');
  readonly isDiscoverLoaded = computed(() => this.stateSignal().discover.status === 'loaded');
  readonly discoverError = computed(() => this.stateSignal().discover.error);
  readonly isFavoritesLoading = computed(() => this.stateSignal().favorites.status === 'loading');
  readonly isFavoritesLoaded = computed(() => this.stateSignal().favorites.status === 'loaded');
  readonly favoritesError = computed(() => this.stateSignal().favorites.error);

  beginDiscoverLoad(): HomeLoadToken | null {
    return this.beginLoad('discover');
  }

  beginFavoritesLoad(): HomeLoadToken | null {
    return this.beginLoad('favorites');
  }

  setDiscoverLoaded(items: readonly RecipeCardDto[], token: HomeLoadToken): boolean {
    return this.setLoaded('discover', items, token, 5);
  }

  setFavoritesLoaded(items: readonly RecipeCardDto[], token: HomeLoadToken): boolean {
    return this.setLoaded('favorites', items, token, 4);
  }

  setDiscoverError(error: string, token: HomeLoadToken): boolean {
    return this.setError('discover', error, token);
  }

  setFavoritesError(error: string, token: HomeLoadToken): boolean {
    return this.setError('favorites', error, token);
  }

  isDiscoverValid(): boolean {
    const current = this.stateSignal().discover;
    return current.status === 'loaded' && !current.stale;
  }

  isFavoritesValid(): boolean {
    const current = this.stateSignal().favorites;
    return current.status === 'loaded' && !current.stale;
  }

  discoverCard(recipeId: number): RecipeCardDto | null {
    return this.stateSignal().discover.items.find(item => item.id === recipeId) ?? null;
  }

  markDiscoverStale(): void {
    this.markStale('discover');
  }

  markFavoritesStale(): void {
    this.markStale('favorites');
  }

  /** Applies a confirmed save only when the existing Favorites snapshot is complete. */
  prependFavorite(recipe: RecipeCardDto): boolean {
    const current = this.stateSignal().favorites;
    if (current.status !== 'loaded') return false;
    const saved = { ...recipe, isSaved: true };
    this.patch('favorites', {
      ...current,
      items: [saved, ...current.items.filter(item => item.id !== recipe.id)].slice(0, 4),
    });
    return true;
  }

  /** Removes only after shared mutation confirmation; an in-flight response is made stale. */
  removeFavorite(recipeId: number): void {
    const current = this.stateSignal().favorites;
    const requestWasInFlight = current.status === 'loading';
    this.patch('favorites', {
      ...current,
      items: current.items.filter(item => item.id !== recipeId),
      stale: requestWasInFlight || current.stale,
      freshnessVersion: requestWasInFlight
        ? current.freshnessVersion + 1
        : current.freshnessVersion,
    });
  }

  reset(): void {
    const current = this.stateSignal();
    this.stateSignal.set({
      discover: section(
        current.discover.generation + 1,
        current.discover.freshnessVersion + 1
      ),
      favorites: section(
        current.favorites.generation + 1,
        current.favorites.freshnessVersion + 1
      ),
    });
  }

  private beginLoad(key: keyof HomeState): HomeLoadToken | null {
    const current = this.stateSignal()[key];
    if (current.status === 'loading') return null;
    const generation = current.generation + 1;
    this.patch(key, { ...current, status: 'loading', error: null, stale: false, generation });
    return { generation, freshnessVersion: current.freshnessVersion };
  }

  private setLoaded(
    key: keyof HomeState,
    items: readonly RecipeCardDto[],
    token: HomeLoadToken,
    limit: number
  ): boolean {
    const current = this.stateSignal()[key];
    if (current.generation !== token.generation) return false;
    const unique = [...new Map(items.map(item => [item.id, item])).values()].slice(0, limit);
    this.patch(key, {
      ...current,
      items: unique,
      status: 'loaded',
      error: null,
      stale: current.freshnessVersion !== token.freshnessVersion,
    });
    return true;
  }

  private setError(key: keyof HomeState, error: string, token: HomeLoadToken): boolean {
    const current = this.stateSignal()[key];
    if (current.generation !== token.generation) return false;
    this.patch(key, { ...current, status: 'error', error });
    return true;
  }

  private markStale(key: keyof HomeState): void {
    const current = this.stateSignal()[key];
    this.patch(key, {
      ...current,
      stale: true,
      freshnessVersion: current.freshnessVersion + 1,
    });
  }

  private patch(key: keyof HomeState, value: HomeSectionState): void {
    this.stateSignal.update(state => ({ ...state, [key]: value }));
  }
}

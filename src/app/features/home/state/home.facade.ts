/**
 * Home query coordinator for independent bounded Discover and Favorites reads.
 * Shared Recipe behavior remains owned by RecipesFacade and canonical Recipe Card components.
 */
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, timeout } from 'rxjs';

import { toApiErrorMessage } from '@app/core/shared/data-access/generic-template/api-error-message';
import { RecipesApi } from '@app/core/shared/data-access/recipes/recipe.api';
import { RecipeDiscoveryCriteria } from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { HomeStore } from './home.store';

const HOME_DISCOVER_LIMIT = 5;
const HOME_FAVORITES_LIMIT = 4;
const DEFAULT_DISCOVER_CRITERIA: RecipeDiscoveryCriteria = {
  search: '',
  ingredientIds: [],
  requireAllIngredients: true,
  badges: [],
  maxTotalMinutes: null,
  maxDifficulty: null,
  savedOnly: false,
};

@Injectable({ providedIn: 'root' })
export class HomeFacade {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(RecipesApi);
  private readonly recipesFacade = inject(RecipesFacade);
  private readonly store = inject(HomeStore);

  readonly discoverRecipes = this.store.discoverRecipes;
  readonly favoriteRecipes = this.store.favoriteRecipes;
  readonly isDiscoverLoading = this.store.isDiscoverLoading;
  readonly isDiscoverLoaded = this.store.isDiscoverLoaded;
  readonly discoverError = this.store.discoverError;
  readonly isFavoritesLoading = this.store.isFavoritesLoading;
  readonly isFavoritesLoaded = this.store.isFavoritesLoaded;
  readonly favoritesError = this.store.favoritesError;

  constructor() {
    this.recipesFacade.favoriteChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(change => {
        if (!change.isSaved) {
          this.store.removeFavorite(change.recipeId);
          return;
        }
        const card = this.store.discoverCard(change.recipeId);
        if (!card || !this.store.prependFavorite(card)) {
          this.store.markFavoritesStale();
        }
      });

    this.recipesFacade.queryInvalidated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.store.markDiscoverStale();
        this.store.markFavoritesStale();
      });
  }

  initialize(): void {
    this.loadDiscoverIfNeeded();
    this.loadFavoritesIfNeeded();
  }

  loadDiscoverIfNeeded(): void {
    if (this.store.isDiscoverValid()) return;
    this.reloadDiscover();
  }

  loadFavoritesIfNeeded(): void {
    if (this.store.isFavoritesValid()) return;
    this.reloadFavorites();
  }

  retryDiscover(): void {
    this.reloadDiscover();
  }

  retryFavorites(): void {
    this.reloadFavorites();
  }

  private reloadDiscover(): void {
    const token = this.store.beginDiscoverLoad();
    if (!token) return;
    this.api.discover(DEFAULT_DISCOVER_CRITERIA, null, HOME_DISCOVER_LIMIT).pipe(
      timeout(10000),
      catchError((error: unknown) => {
        this.store.setDiscoverError(toApiErrorMessage(error), token);
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(page => {
      if (!this.store.setDiscoverLoaded(page.items, token)) return;
      if (this.store.state().discover.stale) this.reloadDiscover();
    });
  }

  private reloadFavorites(): void {
    const token = this.store.beginFavoritesLoad();
    if (!token) return;
    this.api.getFavorites(HOME_FAVORITES_LIMIT).pipe(
      timeout(10000),
      catchError((error: unknown) => {
        this.store.setFavoritesError(toApiErrorMessage(error), token);
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(items => {
      if (!this.store.setFavoritesLoaded(items, token)) return;
      if (this.store.state().favorites.stale) this.reloadFavorites();
    });
  }
}

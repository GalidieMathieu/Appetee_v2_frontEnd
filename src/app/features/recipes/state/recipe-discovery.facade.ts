/**
 * Coordinates URL-applied Recipe Discovery criteria with its persistent query store.
 * It also rebuilds a query when an opaque continuation token becomes invalid, while shared
 * Card/Preview/favorite interaction belongs to the recipe-experience package.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, timeout } from 'rxjs';

import { toApiErrorMessage } from '@app/core/shared/data-access/generic-template/api-error-message';
import { RecipesApi } from '@app/core/shared/data-access/recipes/recipe.api';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { RecipeDiscoveryCriteria } from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipesStore } from '@app/core/shared/data-access/recipes/recipes.store';

import {
  recipeDiscoveryCriteria,
  recipeDiscoveryQueryKey,
} from './recipe-discovery-search';

@Injectable({ providedIn: 'root' })
export class RecipeDiscoveryFacade {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(RecipesApi);
  private readonly store = inject(RecipesStore);
  private readonly recipesFacade = inject(RecipesFacade);

  readonly cards = this.store.cards;
  readonly appliedSearch = this.store.appliedSearch;
  readonly appliedIngredientIds = this.store.appliedIngredientIds;
  readonly appliedRequireAllIngredients = this.store.appliedRequireAllIngredients;
  readonly appliedBadges = this.store.appliedBadges;
  readonly appliedMaxTotalMinutes = this.store.appliedMaxTotalMinutes;
  readonly appliedMaxDifficulty = this.store.appliedMaxDifficulty;
  readonly appliedSavedOnly = this.store.appliedSavedOnly;
  readonly hasAppliedAdvancedFilters = this.store.hasAppliedAdvancedFilters;
  readonly hasMore = this.store.hasMore;
  readonly isInitialLoading = this.store.isInitialLoading;
  readonly initialError = this.store.initialError;
  readonly isLoadingMore = this.store.isLoadingMore;
  readonly loadMoreError = this.store.loadMoreError;

  /** Resets cached discovery whenever a shared recipe query invalidation is announced. */
  constructor() {
    this.recipesFacade.queryInvalidated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.store.reset());
  }

  /** Reuses a matching cached query or starts page one for newly applied URL criteria. */
  initializeFromUrl(urlCriteria: RecipeDiscoveryCriteria): void {
    const criteria = recipeDiscoveryCriteria(urlCriteria);
    const queryKey = recipeDiscoveryQueryKey(criteria);
    if (this.store.reuseQuery(criteria, queryKey)) return;
    this.loadFirstPage(criteria);
  }

  /** Starts a generation-safe first-page request after normalizing applied criteria. */
  loadFirstPage(criteria: RecipeDiscoveryCriteria = this.store.criteria()): void {
    const normalizedCriteria = recipeDiscoveryCriteria(
      criteria
    );
    const generation = this.store.beginQuery(
      normalizedCriteria,
      recipeDiscoveryQueryKey(normalizedCriteria)
    );
    if (generation === null) return;

    this.api.discover(normalizedCriteria, null).pipe(
      timeout(10000),
      catchError((error: unknown) => {
        this.store.failInitialRequest(toApiErrorMessage(error), generation);
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(page => this.store.replacePage(page, generation));
  }

  retryInitial(): void {
    this.loadFirstPage();
  }

  /** Coalesces continuation requests and forwards the current opaque cursor unchanged. */
  loadNextPage(): void {
    const continuation = this.store.beginLoadMoreRequest();
    if (!continuation) return;
    const criteria = this.store.criteria();

    this.api.discover(criteria, continuation.cursor).pipe(
      timeout(10000),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 400) {
          // A continuation token is private server state. Rebuild the visible query rather than
          // exposing cursor details or retrying the same rejected token indefinitely.
          this.loadFirstPage(criteria);
          return EMPTY;
        }
        this.store.failLoadMoreRequest(
          toApiErrorMessage(error),
          continuation.generation
        );
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(page => this.store.appendPage(page, continuation.generation));
  }

  retryLoadMore(): void {
    this.loadNextPage();
  }

  /** Reloads the same applied intent after diets or restrictions change compatibility. */
  invalidateForCompatibilityChange(): void {
    const criteria = this.store.criteria();
    this.store.reset();
    this.loadFirstPage(criteria);
  }

  resetForIdentityChange(): void {
    this.store.reset();
  }
}

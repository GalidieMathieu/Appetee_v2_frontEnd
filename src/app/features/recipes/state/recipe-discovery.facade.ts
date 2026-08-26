import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, timeout } from 'rxjs';

import { toApiErrorMessage } from '@app/core/shared/data-access/generic-template/api-error-message';
import { RecipesApi } from '@app/core/shared/data-access/recipes/recipe.api';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { RecipesStore } from '@app/core/shared/data-access/recipes/recipes.store';

@Injectable({ providedIn: 'root' })
export class RecipeDiscoveryFacade {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(RecipesApi);
  private readonly store = inject(RecipesStore);
  private readonly recipesFacade = inject(RecipesFacade);

  readonly cards = this.store.cards;
  readonly hasMore = this.store.hasMore;
  readonly isInitialLoading = this.store.isInitialLoading;
  readonly initialError = this.store.initialError;
  readonly isLoadingMore = this.store.isLoadingMore;
  readonly loadMoreError = this.store.loadMoreError;

  constructor() {
    this.recipesFacade.queryInvalidated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.store.reset());
  }

  initialize(): void {
    if (this.store.initialRequest().status === 'idle') this.loadFirstPage();
  }

  loadFirstPage(): void {
    const generation = this.store.beginInitialRequest();
    if (generation === null) return;

    this.api.discover().pipe(
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

  loadNextPage(): void {
    const continuation = this.store.beginLoadMoreRequest();
    if (!continuation) return;

    this.api.discover(continuation.cursor).pipe(
      timeout(10000),
      catchError((error: unknown) => {
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

  invalidateForCompatibilityChange(): void {
    this.store.reset();
    this.loadFirstPage();
  }

  resetForIdentityChange(): void {
    this.store.reset();
  }
}

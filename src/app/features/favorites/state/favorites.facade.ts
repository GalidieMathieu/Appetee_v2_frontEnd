/**
 * Favorites page orchestration for cached loading and confirmed shared-mutation synchronization.
 * The page never owns favorite HTTP mutations or Quick Preview behavior.
 */
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, timeout } from 'rxjs';

import { toApiErrorMessage } from '@app/core/shared/data-access/generic-template/api-error-message';
import { RecipesApi } from '@app/core/shared/data-access/recipes/recipe.api';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';

import { FavoritesStore } from './favorites.store';

@Injectable({ providedIn: 'root' })
export class FavoritesFacade {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(RecipesApi);
  private readonly recipesFacade = inject(RecipesFacade);
  private readonly store = inject(FavoritesStore);

  readonly recipes = this.store.recipes;
  readonly isLoading = this.store.isLoading;
  readonly isLoaded = this.store.isLoaded;
  readonly error = this.store.error;

  constructor() {
    this.recipesFacade.favoriteChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(change => {
        if (change.isSaved) this.store.markStale();
        else this.store.remove(change.recipeId);
      });

    this.recipesFacade.queryInvalidated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.store.markStale());
  }

  /** Reuses a valid session list and fetches only idle, failed, or invalidated state. */
  loadIfNeeded(): void {
    if (this.store.isLoaded() && !this.store.stale()) return;
    this.reload();
  }

  reload(): void {
    const token = this.store.beginLoad();
    if (!token) return;

    this.api.getFavorites().pipe(
      timeout(10000),
      catchError((error: unknown) => {
        this.store.setError(toApiErrorMessage(error), token);
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(items => {
      if (!this.store.setLoaded(items, token)) return;
      // A confirmed mutation that raced this read requires one clean server snapshot.
      if (this.store.stale()) this.reload();
    });
  }

  retry(): void {
    this.reload();
  }
}

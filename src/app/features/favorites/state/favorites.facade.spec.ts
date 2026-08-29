/**
 * Favorites facade tests protect bounded loading, cache reuse, retry, and shared mutation sync.
 * Raw favorite mutations remain outside this feature-owned list orchestration.
 */
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { RecipesApi } from '@app/core/shared/data-access/recipes/recipe.api';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { RecipeCardDto, RecipeFavoriteChange } from '@app/core/shared/data-access/recipes/recipe.model';
import { FavoritesFacade } from './favorites.facade';
import { FavoritesStore } from './favorites.store';

describe('FavoritesFacade', () => {
  const getFavorites = vi.fn();
  let favoriteChanged: Subject<RecipeFavoriteChange>;
  let queryInvalidated: Subject<void>;

  beforeEach(() => {
    getFavorites.mockReset();
    favoriteChanged = new Subject<RecipeFavoriteChange>();
    queryInvalidated = new Subject<void>();
    TestBed.configureTestingModule({
      providers: [
        FavoritesFacade,
        FavoritesStore,
        { provide: RecipesApi, useValue: { getFavorites } },
        {
          provide: RecipesFacade,
          useValue: {
            favoriteChanged$: favoriteChanged.asObservable(),
            queryInvalidated$: queryInvalidated.asObservable(),
          },
        },
      ],
    });
  });

  it('issues one initial request and reuses a valid loaded collection', () => {
    getFavorites.mockReturnValue(of([card(2), card(1)]));
    const facade = TestBed.inject(FavoritesFacade);

    facade.loadIfNeeded();
    facade.loadIfNeeded();

    expect(getFavorites).toHaveBeenCalledOnce();
    expect(getFavorites).toHaveBeenCalledWith();
    expect(facade.recipes().map(item => item.id)).toEqual([2, 1]);
  });

  it('coalesces repeated load requests while the first request is pending', () => {
    const pending = new Subject<readonly RecipeCardDto[]>();
    getFavorites.mockReturnValue(pending);
    const facade = TestBed.inject(FavoritesFacade);

    facade.loadIfNeeded();
    facade.loadIfNeeded();

    expect(getFavorites).toHaveBeenCalledOnce();
    pending.next([]);
    pending.complete();
  });

  it('removes only after a confirmed shared unsave and marks saves stale', () => {
    getFavorites.mockReturnValue(of([card(1)]));
    const facade = TestBed.inject(FavoritesFacade);
    const store = TestBed.inject(FavoritesStore);
    facade.loadIfNeeded();

    favoriteChanged.next({ recipeId: 1, isSaved: false });
    expect(facade.recipes()).toEqual([]);
    expect(store.stale()).toBe(false);

    favoriteChanged.next({ recipeId: 2, isSaved: true });
    expect(store.stale()).toBe(true);
  });

  it('refreshes a stale list on the next entry', () => {
    getFavorites.mockReturnValueOnce(of([card(1)])).mockReturnValueOnce(of([card(2)]));
    const facade = TestBed.inject(FavoritesFacade);
    facade.loadIfNeeded();
    favoriteChanged.next({ recipeId: 2, isSaved: true });

    facade.loadIfNeeded();

    expect(getFavorites).toHaveBeenCalledTimes(2);
    expect(facade.recipes().map(item => item.id)).toEqual([2]);
  });

  it('retries after a transient load error', () => {
    getFavorites
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValueOnce(of([card(1)]));
    const facade = TestBed.inject(FavoritesFacade);
    facade.loadIfNeeded();
    expect(facade.error()).not.toBeNull();

    facade.retry();

    expect(facade.error()).toBeNull();
    expect(facade.recipes()).toEqual([card(1)]);
  });

  it('automatically refreshes when a mutation races an in-flight list read', () => {
    const pending = new Subject<readonly RecipeCardDto[]>();
    getFavorites.mockReturnValueOnce(pending).mockReturnValueOnce(of([]));
    const facade = TestBed.inject(FavoritesFacade);
    facade.loadIfNeeded();
    favoriteChanged.next({ recipeId: 1, isSaved: false });

    pending.next([card(1)]);
    pending.complete();

    expect(getFavorites).toHaveBeenCalledTimes(2);
    expect(facade.recipes()).toEqual([]);
  });
});

function card(id: number): RecipeCardDto {
  return {
    id,
    name: `Recipe ${id}`,
    cardImageUrl: null,
    totalTimeMinutes: 30,
    caloriesPerServing: 400,
    estimatedCostPerServing: 3.5,
    badges: ['Quick Meal'],
    featuredIngredients: [],
    isSaved: true,
  };
}

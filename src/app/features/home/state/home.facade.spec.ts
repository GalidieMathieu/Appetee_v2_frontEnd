/** Home facade tests protect independent bounded requests, cache reuse, retry, and shared mutation sync. */
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { RecipesApi } from '@app/core/shared/data-access/recipes/recipe.api';
import {
  RecipeCardDto,
  RecipeDiscoveryPageDto,
  RecipeFavoriteChange,
} from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { HomeFacade } from './home.facade';
import { HomeStore } from './home.store';

describe('HomeFacade', () => {
  const discover = vi.fn();
  const getFavorites = vi.fn();
  let favoriteChanged: Subject<RecipeFavoriteChange>;
  let queryInvalidated: Subject<void>;

  beforeEach(() => {
    discover.mockReset();
    getFavorites.mockReset();
    favoriteChanged = new Subject<RecipeFavoriteChange>();
    queryInvalidated = new Subject<void>();
    discover.mockReturnValue(of(page([card(1)])));
    getFavorites.mockReturnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        HomeFacade,
        HomeStore,
        { provide: RecipesApi, useValue: { discover, getFavorites } },
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

  it('loads Discover with limit five and no cursor while Favorites loads independently', () => {
    const facade = TestBed.inject(HomeFacade);

    facade.initialize();

    expect(discover).toHaveBeenCalledOnce();
    expect(discover.mock.calls[0]?.[1]).toBeNull();
    expect(discover.mock.calls[0]?.[2]).toBe(5);
    expect(getFavorites).toHaveBeenCalledWith(4);
  });

  it('reuses valid Discover and Favorites snapshots on Home re-entry', () => {
    const facade = TestBed.inject(HomeFacade);
    facade.initialize();
    facade.initialize();

    expect(discover).toHaveBeenCalledOnce();
    expect(getFavorites).toHaveBeenCalledOnce();
  });

  it('keeps Favorites successful when Discover fails and retries only Discover', () => {
    discover
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValueOnce(of(page([card(2)])));
    getFavorites.mockReturnValue(of([card(3, true)]));
    const facade = TestBed.inject(HomeFacade);

    facade.initialize();
    expect(facade.discoverError()).not.toBeNull();
    expect(facade.favoriteRecipes().map(item => item.id)).toEqual([3]);

    facade.retryDiscover();
    expect(discover).toHaveBeenCalledTimes(2);
    expect(getFavorites).toHaveBeenCalledOnce();
  });

  it('updates the preview from confirmed shared mutations without issuing mutation HTTP', () => {
    discover.mockReturnValue(of(page([card(5)])));
    getFavorites.mockReturnValue(of([card(1, true)]));
    const facade = TestBed.inject(HomeFacade);
    facade.initialize();

    favoriteChanged.next({ recipeId: 5, isSaved: true });
    expect(facade.favoriteRecipes().map(item => item.id)).toEqual([5, 1]);

    favoriteChanged.next({ recipeId: 5, isSaved: false });
    expect(facade.favoriteRecipes().map(item => item.id)).toEqual([1]);
  });
});

function page(items: readonly RecipeCardDto[]): RecipeDiscoveryPageDto {
  return { items: [...items], nextCursor: 'ignored', hasMore: true };
}

function card(id: number, isSaved = false): RecipeCardDto {
  return {
    id,
    name: `Recipe ${id}`,
    cardImageUrl: null,
    totalTimeMinutes: 30,
    caloriesPerServing: 400,
    estimatedCostPerServing: 3.5,
    badges: [],
    featuredIngredients: [],
    isSaved,
  };
}

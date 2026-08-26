import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { RecipesApi } from '@app/core/shared/data-access/recipes/recipe.api';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { RecipesStore } from '@app/core/shared/data-access/recipes/recipes.store';
import { RecipeCardDto, RecipeDiscoveryPageDto } from '@app/core/shared/data-access/recipes/recipe.model';

import { RecipeDiscoveryFacade } from './recipe-discovery.facade';

describe('RecipeDiscoveryFacade', () => {
  const discover = vi.fn();
  const queryInvalidated = new Subject<void>();

  beforeEach(() => {
    discover.mockReset();
    TestBed.configureTestingModule({
      providers: [
        RecipeDiscoveryFacade,
        RecipesStore,
        { provide: RecipesApi, useValue: { discover } },
        {
          provide: RecipesFacade,
          useValue: { queryInvalidated$: queryInvalidated.asObservable() },
        },
      ],
    });
  });

  it('loads the first page once and sends no cursor', () => {
    discover.mockReturnValue(of(page([card(1)], 'c1')));
    const facade = TestBed.inject(RecipeDiscoveryFacade);

    facade.initialize();
    facade.initialize();

    expect(discover).toHaveBeenCalledOnce();
    expect(discover).toHaveBeenCalledWith();
    expect(facade.cards().map(item => item.id)).toEqual([1]);
    expect(facade.hasMore()).toBe(true);
  });

  it('reuses shared recipe discovery data after feature navigation', () => {
    const store = TestBed.inject(RecipesStore);
    const generation = store.beginInitialRequest()!;
    store.replacePage(page([card(1)], 'persisted-cursor'), generation);

    const facade = TestBed.inject(RecipeDiscoveryFacade);
    facade.initialize();

    expect(discover).not.toHaveBeenCalled();
    expect(facade.cards().map(item => item.id)).toEqual([1]);
    expect(store.nextCursor()).toBe('persisted-cursor');
  });

  it('coalesces duplicate next-page triggers and appends the response', () => {
    const pending = new Subject<RecipeDiscoveryPageDto>();
    discover
      .mockReturnValueOnce(of(page([card(1), card(2)], 'opaque-c1')))
      .mockReturnValueOnce(pending);
    const facade = TestBed.inject(RecipeDiscoveryFacade);
    facade.initialize();

    facade.loadNextPage();
    facade.loadNextPage();

    expect(discover).toHaveBeenCalledTimes(2);
    expect(discover).toHaveBeenLastCalledWith('opaque-c1');
    pending.next(page([card(2), card(3)], null, false));
    pending.complete();
    expect(facade.cards().map(item => item.id)).toEqual([1, 2, 3]);
  });

  it('preserves cards after load-more failure and retries the same cursor', () => {
    discover
      .mockReturnValueOnce(of(page([card(1)], 'retry-cursor')))
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValueOnce(of(page([card(2)], null, false)));
    const facade = TestBed.inject(RecipeDiscoveryFacade);
    facade.initialize();

    facade.loadNextPage();
    expect(facade.cards().map(item => item.id)).toEqual([1]);
    expect(facade.loadMoreError()).toBe('An internal server error occurred. Please try again.');

    facade.retryLoadMore();
    expect(discover).toHaveBeenNthCalledWith(2, 'retry-cursor');
    expect(discover).toHaveBeenNthCalledWith(3, 'retry-cursor');
    expect(facade.cards().map(item => item.id)).toEqual([1, 2]);
  });

  it('ignores a stale first-page response after identity reset', () => {
    const pending = new Subject<RecipeDiscoveryPageDto>();
    discover.mockReturnValueOnce(pending);
    const facade = TestBed.inject(RecipeDiscoveryFacade);
    facade.initialize();

    facade.resetForIdentityChange();
    pending.next(page([card(1)], null, false));
    pending.complete();

    expect(facade.cards()).toEqual([]);
  });

  it('does not request beyond the end of the cursor chain', () => {
    discover.mockReturnValueOnce(of(page([card(1)], null, false)));
    const facade = TestBed.inject(RecipeDiscoveryFacade);
    facade.initialize();

    facade.loadNextPage();

    expect(discover).toHaveBeenCalledOnce();
  });
});

function page(
  items: RecipeCardDto[],
  nextCursor: string | null,
  hasMore = nextCursor !== null
): RecipeDiscoveryPageDto {
  return { items, nextCursor, hasMore };
}

function card(id: number): RecipeCardDto {
  return {
    id,
    name: `Recipe ${id}`,
    cardImageUrl: null,
    totalTimeMinutes: 30,
    caloriesPerServing: 400,
    estimatedCostPerServing: 3.5,
    badges: ['Quick Meal'],
    featuredIngredients: [{ id: 10 + id, name: 'Ingredient', featuredOrder: 1 }],
    isSaved: false,
  };
}

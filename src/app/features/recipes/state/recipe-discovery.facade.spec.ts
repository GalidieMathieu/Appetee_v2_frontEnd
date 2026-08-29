/**
 * Coordinator tests for discovery criteria, cursor continuation, invalidation, and stale results.
 * Invalid opaque cursors must rebuild page one without leaking server cursor implementation.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { RecipesApi } from '@app/core/shared/data-access/recipes/recipe.api';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { RecipesStore } from '@app/core/shared/data-access/recipes/recipes.store';
import { RecipePreviewStore } from '@app/core/shared/data-access/recipes/recipe-preview.store';
import {
  RecipeCardDto,
  RecipeDiscoveryCriteria,
  RecipeDiscoveryPageDto,
} from '@app/core/shared/data-access/recipes/recipe.model';

import { RecipeDiscoveryFacade } from './recipe-discovery.facade';
import { recipeDiscoveryQueryKey } from './recipe-discovery-search';

describe('RecipeDiscoveryFacade', () => {
  const discover = vi.fn();
  const queryInvalidated = new Subject<void>();

  beforeEach(() => {
    discover.mockReset();
    TestBed.configureTestingModule({
      providers: [
        RecipeDiscoveryFacade,
        RecipePreviewStore,
        RecipesStore,
        { provide: RecipesApi, useValue: { discover } },
        {
          provide: RecipesFacade,
          useValue: {
            queryInvalidated$: queryInvalidated.asObservable(),
          },
        },
      ],
    });
  });

  it('loads the first page once and sends no cursor', () => {
    discover.mockReturnValue(of(page([card(1)], 'c1')));
    const facade = TestBed.inject(RecipeDiscoveryFacade);

    facade.initializeFromUrl(criteria());
    facade.initializeFromUrl(criteria());

    expect(discover).toHaveBeenCalledOnce();
    expect(discover).toHaveBeenCalledWith(criteria(), null);
    expect(facade.cards().map(item => item.id)).toEqual([1]);
    expect(facade.hasMore()).toBe(true);
  });

  it('reuses shared recipe discovery data after feature navigation', () => {
    const store = TestBed.inject(RecipesStore);
    const appliedCriteria = criteria('chicken');
    const generation = store.beginQuery(
      appliedCriteria,
      recipeDiscoveryQueryKey(appliedCriteria)
    )!;
    store.replacePage(page([card(1)], 'persisted-cursor'), generation);

    const facade = TestBed.inject(RecipeDiscoveryFacade);
    facade.initializeFromUrl(criteria('Chicken'));

    expect(discover).not.toHaveBeenCalled();
    expect(facade.appliedSearch()).toBe('Chicken');
    expect(facade.cards().map(item => item.id)).toEqual([1]);
    expect(store.nextCursor()).toBe('persisted-cursor');
  });

  it('coalesces duplicate next-page triggers and appends the response', () => {
    const pending = new Subject<RecipeDiscoveryPageDto>();
    discover
      .mockReturnValueOnce(of(page([card(1), card(2)], 'opaque-c1')))
      .mockReturnValueOnce(pending);
    const facade = TestBed.inject(RecipeDiscoveryFacade);
    facade.initializeFromUrl(criteria());

    facade.loadNextPage();
    facade.loadNextPage();

    expect(discover).toHaveBeenCalledTimes(2);
    expect(discover).toHaveBeenLastCalledWith(
      criteria(),
      'opaque-c1'
    );
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
    facade.initializeFromUrl(criteria());

    facade.loadNextPage();
    expect(facade.cards().map(item => item.id)).toEqual([1]);
    expect(facade.loadMoreError()).toBe('An internal server error occurred. Please try again.');

    facade.retryLoadMore();
    expect(discover).toHaveBeenNthCalledWith(
      2,
      criteria(),
      'retry-cursor'
    );
    expect(discover).toHaveBeenNthCalledWith(
      3,
      criteria(),
      'retry-cursor'
    );
    expect(facade.cards().map(item => item.id)).toEqual([1, 2]);
  });

  it('restarts page one when the server rejects an opaque continuation cursor', () => {
    discover
      .mockReturnValueOnce(of(page([card(1)], 'expired-cursor')))
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 400 })))
      .mockReturnValueOnce(of(page([card(2)], null, false)));
    const facade = TestBed.inject(RecipeDiscoveryFacade);
    const appliedCriteria = criteria('chicken');
    facade.initializeFromUrl(appliedCriteria);

    facade.loadNextPage();

    expect(discover).toHaveBeenNthCalledWith(2, appliedCriteria, 'expired-cursor');
    expect(discover).toHaveBeenNthCalledWith(3, appliedCriteria, null);
    expect(facade.cards().map(item => item.id)).toEqual([2]);
    expect(facade.loadMoreError()).toBeNull();
  });

  it('ignores a stale first-page response after identity reset', () => {
    const pending = new Subject<RecipeDiscoveryPageDto>();
    discover.mockReturnValueOnce(pending);
    const facade = TestBed.inject(RecipeDiscoveryFacade);
    facade.initializeFromUrl(criteria());

    facade.resetForIdentityChange();
    pending.next(page([card(1)], null, false));
    pending.complete();

    expect(facade.cards()).toEqual([]);
  });

  it('reloads current criteria and rejects the stale response after compatibility changes', () => {
    const stale = new Subject<RecipeDiscoveryPageDto>();
    discover
      .mockReturnValueOnce(stale)
      .mockReturnValueOnce(of(page([card(2)], null, false)));
    const facade = TestBed.inject(RecipeDiscoveryFacade);
    const appliedCriteria = criteria('chicken', { badges: ['High Protein'] });
    facade.initializeFromUrl(appliedCriteria);

    facade.invalidateForCompatibilityChange();
    stale.next(page([card(1)], null, false));
    stale.complete();

    expect(discover).toHaveBeenCalledTimes(2);
    expect(discover).toHaveBeenLastCalledWith(appliedCriteria, null);
    expect(facade.cards().map(item => item.id)).toEqual([2]);
  });

  it('does not erase a valid Preview when discovery query state is invalidated', () => {
    const previewStore = TestBed.inject(RecipePreviewStore);
    previewStore.upsert({
      id: 7,
      name: 'Recipe 7',
      description: 'A lightweight Preview.',
      previewImageUrl: null,
      totalTimeMinutes: 30,
      caloriesPerServing: 400,
      proteinPerServing: 20,
      estimatedCostPerServing: 3.5,
      badges: [],
      ingredients: [],
      isSaved: false,
    });
    TestBed.inject(RecipeDiscoveryFacade);

    queryInvalidated.next();

    expect(previewStore.get(7)?.name).toBe('Recipe 7');
  });

  it('does not request beyond the end of the cursor chain', () => {
    discover.mockReturnValueOnce(of(page([card(1)], null, false)));
    const facade = TestBed.inject(RecipeDiscoveryFacade);
    facade.initializeFromUrl(criteria());

    facade.loadNextPage();

    expect(discover).toHaveBeenCalledOnce();
  });

  it('normalizes URL search, replaces the query, and carries search into pagination', () => {
    discover
      .mockReturnValueOnce(of(page([card(1)], 'search-cursor')))
      .mockReturnValueOnce(of(page([card(2)], null, false)));
    const facade = TestBed.inject(RecipeDiscoveryFacade);

    facade.initializeFromUrl(criteria('  Chicken   Rice  '));
    facade.loadNextPage();

    expect(facade.appliedSearch()).toBe('Chicken Rice');
    expect(discover).toHaveBeenNthCalledWith(
      1,
      criteria('Chicken Rice'),
      null
    );
    expect(discover).toHaveBeenNthCalledWith(
      2,
      criteria('Chicken Rice'),
      'search-cursor'
    );
    expect(facade.cards().map(item => item.id)).toEqual([1, 2]);
  });

  it('keeps all applied filters in the first and continuation requests', () => {
    discover
      .mockReturnValueOnce(of(page([card(1)], 'saved-cursor')))
      .mockReturnValueOnce(of(page([card(2)], null, false)));
    const facade = TestBed.inject(RecipeDiscoveryFacade);

    const filteredCriteria = criteria('Chicken', {
      ingredientIds: [12, 34, 99],
      requireAllIngredients: false,
      badges: ['High Protein', 'Quick Meal'],
      maxTotalMinutes: 45,
      maxDifficulty: 'Medium',
      savedOnly: true,
    });
    facade.initializeFromUrl(filteredCriteria);
    facade.loadNextPage();

    expect(facade.appliedSavedOnly()).toBe(true);
    expect(facade.appliedIngredientIds()).toEqual([12, 34, 99]);
    expect(facade.appliedRequireAllIngredients()).toBe(false);
    expect(facade.appliedBadges()).toEqual(['High Protein', 'Quick Meal']);
    expect(facade.appliedMaxTotalMinutes()).toBe(45);
    expect(facade.appliedMaxDifficulty()).toBe('Medium');
    expect(discover).toHaveBeenNthCalledWith(
      1,
      filteredCriteria,
      null
    );
    expect(discover).toHaveBeenNthCalledWith(
      2,
      filteredCriteria,
      'saved-cursor'
    );
  });

  it('rejects an old search response after a different URL search starts', () => {
    const oldSearch = new Subject<RecipeDiscoveryPageDto>();
    discover
      .mockReturnValueOnce(oldSearch)
      .mockReturnValueOnce(of(page([card(2)], null, false)));
    const facade = TestBed.inject(RecipeDiscoveryFacade);

    facade.initializeFromUrl(criteria('chicken'));
    facade.initializeFromUrl(criteria('soup'));
    oldSearch.next(page([card(1)], null, false));
    oldSearch.complete();

    expect(facade.appliedSearch()).toBe('soup');
    expect(facade.cards().map(item => item.id)).toEqual([2]);
  });
});

function criteria(
  search = '',
  overrides: Partial<RecipeDiscoveryCriteria> = {}
): RecipeDiscoveryCriteria {
  return {
    search,
    ingredientIds: [],
    requireAllIngredients: true,
    badges: [],
    maxTotalMinutes: null,
    maxDifficulty: null,
    savedOnly: false,
    ...overrides,
  };
}

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

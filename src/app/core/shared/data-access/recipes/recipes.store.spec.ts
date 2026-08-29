/**
 * State-transition tests for the persistent recipe discovery query cache.
 * Phase 11 verifies persistent query reuse and generation rejection across invalidation boundaries.
 */
import {
  RecipeCardDto,
  RecipeDiscoveryCriteria,
  RecipeDiscoveryPageDto,
} from './recipe.model';
import { RecipesStore } from './recipes.store';

describe('RecipesStore', () => {
  let store: RecipesStore;

  beforeEach(() => {
    store = new RecipesStore();
  });

  it('replaces the first page and de-duplicates IDs in backend order', () => {
    const generation = beginQuery(store);
    expect(generation).not.toBeNull();

    store.replacePage(page([card(1), card(2), { ...card(1), name: 'Updated one' }], 'c1'), generation!);

    expect(store.cards().map(item => item.id)).toEqual([1, 2]);
    expect(store.cards()[0]?.name).toBe('Updated one');
    expect(store.nextCursor()).toBe('c1');
    expect(store.hasMore()).toBe(true);
    expect(store.initialRequest().status).toBe('success');
    expect(store.loadMoreRequest().status).toBe('idle');
  });

  it('appends in backend order, updates duplicates, and prevents concurrent continuation', () => {
    const generation = beginQuery(store)!;
    store.replacePage(page([card(1), card(2)], 'c1'), generation);

    expect(store.beginLoadMoreRequest()).toEqual({ cursor: 'c1', generation });
    expect(store.beginLoadMoreRequest()).toBeNull();

    store.appendPage(
      page([{ ...card(2), name: 'Updated two' }, card(3)], null, false),
      generation
    );

    expect(store.cards().map(item => item.id)).toEqual([1, 2, 3]);
    expect(store.cards()[1]?.name).toBe('Updated two');
    expect(store.hasMore()).toBe(false);
    expect(store.nextCursor()).toBeNull();
    expect(store.beginLoadMoreRequest()).toBeNull();
  });

  it('preserves existing cards and the pending cursor after a load-more error', () => {
    const generation = beginQuery(store)!;
    store.replacePage(page([card(1), card(2)], 'retry-cursor'), generation);
    store.beginLoadMoreRequest();

    store.failLoadMoreRequest('Could not load more.', generation);

    expect(store.cards().map(item => item.id)).toEqual([1, 2]);
    expect(store.loadMoreError()).toBe('Could not load more.');
    expect(store.beginLoadMoreRequest()).toEqual({ cursor: 'retry-cursor', generation });
  });

  it('rejects stale responses after a reset changes the query generation', () => {
    const staleGeneration = beginQuery(store)!;

    store.reset();

    expect(store.replacePage(page([card(1)], null, false), staleGeneration)).toBe(false);
    expect(store.cards()).toEqual([]);
    expect(store.initialRequest().status).toBe('idle');
  });

  it('keeps initial and load-more errors independent', () => {
    const initialGeneration = beginQuery(store)!;
    store.failInitialRequest('Initial failed.', initialGeneration);
    expect(store.initialError()).toBe('Initial failed.');
    expect(store.loadMoreError()).toBeNull();

    const loadedGeneration = beginQuery(store)!;
    store.replacePage(page([card(1)], 'c1'), loadedGeneration);
    store.beginLoadMoreRequest();
    store.failLoadMoreRequest('More failed.', loadedGeneration);

    expect(store.initialError()).toBeNull();
    expect(store.loadMoreError()).toBe('More failed.');
  });

  it('replaces cards and cursor when the applied search query changes', () => {
    const browseGeneration = beginQuery(store)!;
    store.replacePage(page([card(1)], 'browse-cursor'), browseGeneration);

    const searchGeneration = beginQuery(store, 'chicken')!;

    expect(searchGeneration).toBeGreaterThan(browseGeneration);
    expect(store.appliedSearch()).toBe('chicken');
    expect(store.cards()).toEqual([]);
    expect(store.nextCursor()).toBeNull();
    expect(store.initialRequest().status).toBe('loading');
    expect(store.replacePage(page([card(2)], null, false), browseGeneration)).toBe(false);
  });

  it('reuses an equivalent loaded query while retaining the URL display value', () => {
    const generation = beginQuery(store, 'Chicken')!;
    store.replacePage(page([card(1)], 'search-cursor'), generation);

    expect(store.reuseQuery(
      criteria('chicken'),
      'search:chicken'
    )).toBe(true);
    expect(store.appliedSearch()).toBe('chicken');
    expect(store.cards().map(item => item.id)).toEqual([1]);
    expect(store.nextCursor()).toBe('search-cursor');
  });

  it('patches favorite membership for one loaded card without changing order', () => {
    const generation = beginQuery(store)!;
    store.replacePage(page([card(1), card(2)], 'cursor'), generation);

    expect(store.updateSaved(2, true)).toBe(true);

    expect(store.cards().map(item => item.id)).toEqual([1, 2]);
    expect(store.card(1)?.isSaved).toBe(false);
    expect(store.card(2)?.isSaved).toBe(true);
    expect(store.updateSaved(99, true)).toBe(false);
  });

  it('starts a new query chain when savedOnly changes', () => {
    const browseGeneration = beginQuery(store)!;
    store.replacePage(page([card(1)], 'browse-cursor'), browseGeneration);

    const savedGeneration = store.beginQuery(
      criteria('', { savedOnly: true }),
      'search:|saved:true'
    )!;

    expect(store.appliedSavedOnly()).toBe(true);
    expect(store.cards()).toEqual([]);
    expect(store.nextCursor()).toBeNull();
    expect(savedGeneration).toBeGreaterThan(browseGeneration);
  });

  it('starts a new chain when badge, time, or difficulty criteria change', () => {
    const initialGeneration = beginQuery(store)!;
    store.replacePage(page([card(1)], 'cursor'), initialGeneration);
    const filters = criteria('', {
      badges: ['High Protein', 'Quick Meal'],
      maxTotalMinutes: 45,
      maxDifficulty: 'Medium',
    });

    const filteredGeneration = store.beginQuery(filters, 'filtered')!;

    expect(filteredGeneration).toBeGreaterThan(initialGeneration);
    expect(store.appliedBadges()).toEqual(['High Protein', 'Quick Meal']);
    expect(store.appliedMaxTotalMinutes()).toBe(45);
    expect(store.appliedMaxDifficulty()).toBe('Medium');
    expect(store.hasAppliedAdvancedFilters()).toBe(true);
    expect(store.cards()).toEqual([]);
  });

  it('stores applied ingredient IDs and ANY composition as advanced filter state', () => {
    const filteredGeneration = store.beginQuery(criteria('', {
      ingredientIds: [12, 34, 99],
      requireAllIngredients: false,
    }), 'ingredients:any')!;

    expect(store.appliedIngredientIds()).toEqual([12, 34, 99]);
    expect(store.appliedRequireAllIngredients()).toBe(false);
    expect(store.hasAppliedAdvancedFilters()).toBe(true);
    expect(filteredGeneration).toBeGreaterThan(0);
  });
});

function beginQuery(store: RecipesStore, search = ''): number | null {
  return store.beginQuery(
    criteria(search),
    `search:${search.toLowerCase()}`
  );
}

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
    cardImageUrl: `https://cdn.example.com/cards/${id}.jpg`,
    totalTimeMinutes: 30,
    caloriesPerServing: 400,
    estimatedCostPerServing: 3.5,
    badges: ['Quick Meal'],
    featuredIngredients: [{ id: 10 + id, name: 'Ingredient', featuredOrder: 1 }],
    isSaved: false,
  };
}

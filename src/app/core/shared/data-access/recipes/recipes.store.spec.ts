import { RecipeCardDto, RecipeDiscoveryPageDto } from './recipe.model';
import { RecipesStore } from './recipes.store';

describe('RecipesStore', () => {
  let store: RecipesStore;

  beforeEach(() => {
    store = new RecipesStore();
  });

  it('replaces the first page and de-duplicates IDs in backend order', () => {
    const generation = store.beginInitialRequest();
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
    const generation = store.beginInitialRequest()!;
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
    const generation = store.beginInitialRequest()!;
    store.replacePage(page([card(1), card(2)], 'retry-cursor'), generation);
    store.beginLoadMoreRequest();

    store.failLoadMoreRequest('Could not load more.', generation);

    expect(store.cards().map(item => item.id)).toEqual([1, 2]);
    expect(store.loadMoreError()).toBe('Could not load more.');
    expect(store.beginLoadMoreRequest()).toEqual({ cursor: 'retry-cursor', generation });
  });

  it('rejects stale responses after a reset changes the query generation', () => {
    const staleGeneration = store.beginInitialRequest()!;

    store.reset();

    expect(store.replacePage(page([card(1)], null, false), staleGeneration)).toBe(false);
    expect(store.cards()).toEqual([]);
    expect(store.initialRequest().status).toBe('idle');
  });

  it('keeps initial and load-more errors independent', () => {
    const initialGeneration = store.beginInitialRequest()!;
    store.failInitialRequest('Initial failed.', initialGeneration);
    expect(store.initialError()).toBe('Initial failed.');
    expect(store.loadMoreError()).toBeNull();

    const loadedGeneration = store.beginInitialRequest()!;
    store.replacePage(page([card(1)], 'c1'), loadedGeneration);
    store.beginLoadMoreRequest();
    store.failLoadMoreRequest('More failed.', loadedGeneration);

    expect(store.initialError()).toBeNull();
    expect(store.loadMoreError()).toBe('More failed.');
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
    cardImageUrl: `https://cdn.example.com/cards/${id}.jpg`,
    totalTimeMinutes: 30,
    caloriesPerServing: 400,
    estimatedCostPerServing: 3.5,
    badges: ['Quick Meal'],
    featuredIngredients: [{ id: 10 + id, name: 'Ingredient', featuredOrder: 1 }],
    isSaved: false,
  };
}

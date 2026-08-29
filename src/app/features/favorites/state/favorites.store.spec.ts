/** Favorites store tests protect cache reuse, mutation races, final-item removal, and identity reset. */
import { FavoritesStore } from './favorites.store';
import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';

describe('FavoritesStore', () => {
  let store: FavoritesStore;

  beforeEach(() => store = new FavoritesStore());

  it('loads server order and de-duplicates defensive duplicate IDs', () => {
    const token = store.beginLoad()!;
    expect(store.isLoading()).toBe(true);

    expect(store.setLoaded([card(2), card(1), card(2)], token)).toBe(true);

    expect(store.recipes().map(item => item.id)).toEqual([2, 1]);
    expect(store.isLoaded()).toBe(true);
    expect(store.stale()).toBe(false);
  });

  it('removes a confirmed unsave and leaves a loaded empty collection', () => {
    const token = store.beginLoad()!;
    store.setLoaded([card(1)], token);

    store.remove(1);

    expect(store.recipes()).toEqual([]);
    expect(store.isLoaded()).toBe(true);
  });

  it('marks a response stale when a confirmed mutation races its request', () => {
    const token = store.beginLoad()!;
    store.markStale();

    store.setLoaded([card(1)], token);

    expect(store.stale()).toBe(true);
  });

  it('rejects a response from before an identity reset', () => {
    const token = store.beginLoad()!;
    store.reset();

    expect(store.setLoaded([card(1)], token)).toBe(false);
    expect(store.recipes()).toEqual([]);
    expect(store.status()).toBe('idle');
  });
});

function card(id: number): RecipeCardDto {
  return {
    id,
    name: `Recipe ${id}`,
    cardImageUrl: null,
    totalTimeMinutes: 20,
    caloriesPerServing: 300,
    estimatedCostPerServing: 2,
    badges: [],
    featuredIngredients: [],
    isSaved: true,
  };
}

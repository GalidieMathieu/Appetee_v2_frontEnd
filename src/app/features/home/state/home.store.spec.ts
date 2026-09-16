/** Home store tests protect bounded projections, session reuse, mutation sync, and identity reset. */
import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';
import { HomeStore } from './home.store';

describe('HomeStore', () => {
  let store: HomeStore;

  beforeEach(() => store = new HomeStore());

  it('keeps valid Discover cards reusable and bounds the projection to five', () => {
    const token = store.beginDiscoverLoad()!;
    store.setDiscoverLoaded([card(1), card(2), card(3), card(4), card(5), card(6)], token);

    expect(store.discoverRecipes().map(item => item.id)).toEqual([1, 2, 3, 4, 5]);
    expect(store.isDiscoverValid()).toBe(true);
  });

  it('prepends confirmed Discover saves newest-first and keeps at most four favorites', () => {
    const discoverToken = store.beginDiscoverLoad()!;
    store.setDiscoverLoaded([card(5)], discoverToken);
    const favoritesToken = store.beginFavoritesLoad()!;
    store.setFavoritesLoaded([card(1, true), card(2, true), card(3, true), card(4, true)], favoritesToken);

    expect(store.prependFavorite(store.discoverCard(5)!)).toBe(true);

    expect(store.favoriteRecipes().map(item => item.id)).toEqual([5, 1, 2, 3]);
    expect(store.favoriteRecipes()[0]?.isSaved).toBe(true);
  });

  it('removes the final confirmed favorite without converting the request to an error', () => {
    const token = store.beginFavoritesLoad()!;
    store.setFavoritesLoaded([card(1, true)], token);

    store.removeFavorite(1);

    expect(store.favoriteRecipes()).toEqual([]);
    expect(store.isFavoritesLoaded()).toBe(true);
  });

  it('clears both account-scoped sections and rejects pre-reset responses', () => {
    const discoverToken = store.beginDiscoverLoad()!;
    const favoritesToken = store.beginFavoritesLoad()!;
    store.reset();

    expect(store.setDiscoverLoaded([card(1)], discoverToken)).toBe(false);
    expect(store.setFavoritesLoaded([card(2, true)], favoritesToken)).toBe(false);
    expect(store.discoverRecipes()).toEqual([]);
    expect(store.favoriteRecipes()).toEqual([]);
  });
});

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

/**
 * Root-provider regression coverage for stores that must be cleared at an identity boundary.
 * Shared Preview and Favorites caches must both participate in the session reset workflow.
 */
import { RecipePreviewStore } from './core/shared/data-access/recipes/recipe-preview.store';
import { SESSION_RESETTERS } from './core/session/session-reset.token';
import { FavoritesStore } from './features/favorites/state/favorites.store';
import { appConfig } from './app.config';

describe('appConfig session stores', () => {
  it('registers RecipePreviewStore as an identity-scoped resetter', () => {
    expect(appConfig.providers).toContainEqual({
      provide: SESSION_RESETTERS,
      useExisting: RecipePreviewStore,
      multi: true,
    });
  });

  it('registers FavoritesStore as an identity-scoped resetter', () => {
    expect(appConfig.providers).toContainEqual({
      provide: SESSION_RESETTERS,
      useExisting: FavoritesStore,
      multi: true,
    });
  });
});

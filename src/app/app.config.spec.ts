/**
 * Root-provider regression coverage for stores that must be cleared at an identity boundary.
 * Phase 12 verifies the shared Preview cache participates in the existing session reset workflow.
 */
import { RecipePreviewStore } from './core/shared/data-access/recipes/recipe-preview.store';
import { SESSION_RESETTERS } from './core/session/session-reset.token';
import { appConfig } from './app.config';

describe('appConfig session stores', () => {
  it('registers RecipePreviewStore as an identity-scoped resetter', () => {
    expect(appConfig.providers).toContainEqual({
      provide: SESSION_RESETTERS,
      useExisting: RecipePreviewStore,
      multi: true,
    });
  });
});

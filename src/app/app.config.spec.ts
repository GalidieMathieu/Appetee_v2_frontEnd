/**
 * Root-provider regression coverage for stores that must be cleared at an identity boundary.
 * Shared Preview/Cooking caches, transient return context, and Favorites join session reset.
 */
import { RecipeCookingStore } from './core/shared/data-access/recipes/recipe-cooking.store';
import { RecipePreviewStore } from './core/shared/data-access/recipes/recipe-preview.store';
import { RecipeExperienceFacade } from './core/shared/ui/recipe-experience/recipe-experience.facade';
import { SESSION_RESETTERS } from './core/session/session-reset.token';
import { FavoritesStore } from './features/favorites/state/favorites.store';
import { appConfig } from './app.config';
import { MealPlanContextStore } from './core/shared/data-access/meal-plan/meal-plan-context.store';
import { MealPlannerStore } from './core/shared/data-access/meal-plan/meal-planner.store';
import { NutritionPlanDetailsStore } from './core/shared/data-access/meal-plan/nutrition-plan-details.store';
import { NutritionPlansStore } from './core/shared/data-access/meal-plan/nutrition-plans.store';
import { NutritionProfileStore } from './core/shared/data-access/user/nutrition-profile.store';
import { MealPlanMutationCoordinator } from './core/shared/data-access/meal-plan/meal-plan-mutation-coordinator';
import { CsrfTokenService } from './core/auth/csrf-token.service';

describe('appConfig session stores', () => {
  it('registers RecipePreviewStore as an identity-scoped resetter', () => {
    expect(appConfig.providers).toContainEqual({
      provide: SESSION_RESETTERS,
      useExisting: RecipePreviewStore,
      multi: true,
    });
  });

  it('registers RecipeCookingStore as an identity-scoped resetter', () => {
    expect(appConfig.providers).toContainEqual({
      provide: SESSION_RESETTERS,
      useExisting: RecipeCookingStore,
      multi: true,
    });
  });

  it('registers RecipeExperienceFacade as an identity-scoped resetter', () => {
    expect(appConfig.providers).toContainEqual({
      provide: SESSION_RESETTERS,
      useExisting: RecipeExperienceFacade,
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

  it.each([
    CsrfTokenService,
    MealPlanContextStore,
    MealPlannerStore,
    NutritionPlansStore,
    NutritionPlanDetailsStore,
    NutritionProfileStore,
    MealPlanMutationCoordinator,
  ])('registers %s through its existing root instance', store => {
    expect(appConfig.providers).toContainEqual({
      provide: SESSION_RESETTERS,
      useExisting: store,
      multi: true,
    });
  });
});

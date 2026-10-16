/**
 * Root Angular provider configuration, including every identity-scoped store reset on session changes.
 * Feature query stores and transient Recipe Experience context join the cookie-session reset flow.
 */
import { ApplicationConfig, provideAppInitializer, provideBrowserGlobalErrorListeners, inject } from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { apiErrorInterceptor } from './core/api/api-error.interceptor';

import { routes } from './app.routes';

import { SESSION_RESETTERS } from './core/session/session-reset.token';

import { DietsStore } from './core/shared/data-access/diets/diets.store';
import { IngredientsStore } from './core/shared/data-access/ingredients/ingredients.store';
import { AuthStore } from './core/auth/data-access/auth.store';
import { authInterceptor } from './core/auth/auth.interceptor';
import { UserStore } from './core/shared/data-access/user/user.store';
import { AuthFacade } from './core/auth/data-access/auth.facade';
import { RecipeDetailsStore } from './core/shared/data-access/recipes/recipe-details.store';
import { AdminRecipeStore } from './core/shared/data-access/recipes/admin/admin-recipe.store';
import { IngredientDetailsStore } from './core/shared/data-access/ingredients/admin/ingredient-details.store';
import { AdminIngredientStore } from './core/shared/data-access/ingredients/admin/admin-ingredient.store';
import { RecipesStore } from './core/shared/data-access/recipes/recipes.store';
import { RecipePreviewStore } from './core/shared/data-access/recipes/recipe-preview.store';
import { RecipeCookingStore } from './core/shared/data-access/recipes/recipe-cooking.store';
import { FavoritesStore } from './features/favorites/state/favorites.store';
import { HomeStore } from './features/home/state/home.store';
import { RecipeExperienceFacade } from './core/shared/ui/recipe-experience/recipe-experience.facade';
import { MealPlanContextStore } from './core/shared/data-access/meal-plan/meal-plan-context.store';
import { MealPlannerStore } from './core/shared/data-access/meal-plan/meal-planner.store';
import { NutritionPlansStore } from './core/shared/data-access/meal-plan/nutrition-plans.store';
import { NutritionPlanDetailsStore } from './core/shared/data-access/meal-plan/nutrition-plan-details.store';
import { NutritionProfileStore } from './core/shared/data-access/user/nutrition-profile.store';
import { MealPlanMutationCoordinator } from './core/shared/data-access/meal-plan/meal-plan-mutation-coordinator';
import { CsrfTokenService } from './core/auth/csrf-token.service';
import { CapabilitiesStore } from './core/auth/data-access/capabilities.store';
import { CatalogueStateStore } from './core/shared/data-access/catalogue/catalogue-state.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Staying in a guarded editor must restore the browser's history position,
    // so a subsequent Back can ask again rather than losing the parent entry.
    provideRouter(routes, withRouterConfig({ canceledNavigationResolution: 'computed' })),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor,apiErrorInterceptor])
    ),
    // Restore a valid cookie-backed session before the router renders any guarded route.
    provideAppInitializer(() => inject(AuthFacade).restoreSession$()),
    // Register stores for resetAll()
    { provide: SESSION_RESETTERS, useExisting: CapabilitiesStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: CatalogueStateStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: CsrfTokenService, multi: true },
    { provide: SESSION_RESETTERS, useExisting: RecipesStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: RecipePreviewStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: RecipeCookingStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: RecipeExperienceFacade, multi: true },
    { provide: SESSION_RESETTERS, useExisting: RecipeDetailsStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: FavoritesStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: HomeStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: AdminRecipeStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: DietsStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: IngredientsStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: IngredientDetailsStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: AdminIngredientStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: AuthStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: UserStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: MealPlanContextStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: MealPlannerStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: NutritionPlansStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: NutritionPlanDetailsStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: NutritionProfileStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: MealPlanMutationCoordinator, multi: true },
  ]
};

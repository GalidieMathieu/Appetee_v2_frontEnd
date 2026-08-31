/**
 * Root Angular provider configuration, including every identity-scoped store reset on session changes.
 * Feature query stores join shared caches in the existing cookie-session reset workflow.
 */
import { ApplicationConfig, provideAppInitializer, provideBrowserGlobalErrorListeners, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
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
import { FavoritesStore } from './features/favorites/state/favorites.store';
import { HomeStore } from './features/home/state/home.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor,apiErrorInterceptor])
    ),
    // Restore a valid cookie-backed session before the router renders any guarded route.
    provideAppInitializer(() => inject(AuthFacade).restoreSession$()),
    // Register stores for resetAll()
    { provide: SESSION_RESETTERS, useExisting: RecipesStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: RecipePreviewStore, multi: true },
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
  ]
};

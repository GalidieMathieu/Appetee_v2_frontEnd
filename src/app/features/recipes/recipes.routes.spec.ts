import { Routes } from '@angular/router';

import { routes } from '@app/app.routes';
import { authGuard } from '@app/core/auth/auth.guard';
import { PrivateLayoutComponent } from '@app/core/layout/private-layout/private-layout.component';

import { RecipesListComponent } from './RecipesList/recipesList.page';
import { RECIPES_ROUTES } from './recipes.routes';

describe('recipes routing', () => {
  it('loads the recipes feature beneath the authenticated private layout', async () => {
    const privateRoute = routes.find(route => route.component === PrivateLayoutComponent);
    const recipesRoute = privateRoute?.children?.find(route => route.path === 'recipes');

    expect(privateRoute?.canActivate).toContain(authGuard);
    expect(recipesRoute).toBeDefined();
    expect(recipesRoute?.loadChildren).toBeTypeOf('function');

    const loadedRoutes = await recipesRoute?.loadChildren?.();
    expect(loadedRoutes as Routes).toBe(RECIPES_ROUTES);
  });

  it('uses the feature root for the recipe discovery page', () => {
    expect(RECIPES_ROUTES).toEqual([
      expect.objectContaining({
        path: '',
        title: 'Recipes',
        component: RecipesListComponent,
      }),
    ]);
  });
});

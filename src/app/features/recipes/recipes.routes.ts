/** Authenticated Recipes routes expose discovery and the dedicated per-recipe Cooking Mode page. */
import { Routes } from '@angular/router';

import { RecipesListComponent } from './RecipesList/recipesList.page';
import { RecipeCookingPageComponent } from './cooking/recipe-cooking.page';

export const RECIPES_ROUTES: Routes = [
  {
    path: ':id/cooking',
    title: 'Cooking Mode',
    component: RecipeCookingPageComponent,
  },
  {
    path: '',
    title: 'Recipes',
    component: RecipesListComponent,
  },
];

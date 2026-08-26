import { Routes } from '@angular/router';

import { RecipesListComponent } from './RecipesList/recipesList.page';

export const RECIPES_ROUTES: Routes = [
  {
    path: '',
    title: 'Recipes',
    component: RecipesListComponent,
  },
];

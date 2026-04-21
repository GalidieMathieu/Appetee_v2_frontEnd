import { Routes } from '@angular/router';
import { AdminRecipesPageComponent } from './admin-recipes.page';
import { AdminRecipesSuccessPageComponent } from './admin-recipes-success.page';

export const ADMINRECIPES_ROUTES: Routes = [
  {
    path: 'create',
    title: 'Create Recipe',
    component: AdminRecipesPageComponent,
  },
  {
    path: 'create/success/:id',
    title: 'Recipe Created',
    component: AdminRecipesSuccessPageComponent,
  },
  {
    path: ':id/edit',
    title: 'Edit Recipe',
    component: AdminRecipesPageComponent,
  },
];

/*

how to use it : 
  goToEditRecipe(recipeId: number): void {
    void this.router.navigate(['/admin-recipes', recipeId, 'edit']);
  }

  <button [routerLink]="['/admin-recipes', recipe.id, 'edit']">
    Edit
  </button>
*/

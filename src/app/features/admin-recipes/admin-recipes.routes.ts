import { Routes } from '@angular/router';
import { AdminRecipesPageComponent } from './admin-recipes.page';
import { AdminRecipesSuccessPageComponent } from './admin-recipes-success.page';
import { catalogueGuard } from '@app/core/auth/catalogue.guard';

export const ADMINRECIPES_ROUTES: Routes = [
  {
    path: 'create',
    canActivate: [catalogueGuard], data: { cataloguePermissions: ['Catalog.Write'] },
    title: 'Create Recipe',
    component: AdminRecipesPageComponent,
  },
  {
    path: 'create/success/:id',
    canActivate: [catalogueGuard], data: { cataloguePermissions: ['Catalog.Write'] },
    title: 'Recipe Created',
    component: AdminRecipesSuccessPageComponent,
  },
  {
    path: ':id/edit',
    canActivate: [catalogueGuard], data: { cataloguePermissions: ['Catalog.ReadAdmin', 'Catalog.Write'] },
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

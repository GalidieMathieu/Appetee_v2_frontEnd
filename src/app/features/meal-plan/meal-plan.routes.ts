import { Routes } from '@angular/router';

import { MealPlanWizard } from './meal-plan.wizard';
import { mealPlanWizardGuard } from './meal-plan.wizard.guard';

const wizardChildren: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'target' },
  {
    path: 'target',
    loadComponent: () =>
      import('./steps/step-target.page').then(m => m.StepTargetPageComponent),
  },
  {
    path: 'recipes',
    loadComponent: () =>
      import('./steps/step-recipes.page').then(m => m.StepRecipesPageComponent),
  },
  {
    path: 'preview',
    loadComponent: () =>
      import('./steps/step-preview.page').then(m => m.StepPreviewPageComponent),
  },
  {
    path: 'shopping',
    loadComponent: () =>
      import('./steps/step-shopping.page').then(m => m.StepShoppingPageComponent),
  },
];

export const MEALPLAN_ROUTES: Routes = [
  {
    path: 'new',
    loadComponent: () =>
      import('./meal-plan.shell.page').then(m => m.MealPlanShellPageComponent),
    providers: [MealPlanWizard],
    canActivateChild: [mealPlanWizardGuard],
    children: wizardChildren,
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./meal-plan.shell.page').then(m => m.MealPlanShellPageComponent),
    providers: [MealPlanWizard],
    canActivateChild: [mealPlanWizardGuard],
    children: wizardChildren,
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./meal-plan-detail.page').then(m => m.MealPlanDetailPageComponent),
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./meal-plan.page').then(m => m.MealPlanPageComponent),
  },
];

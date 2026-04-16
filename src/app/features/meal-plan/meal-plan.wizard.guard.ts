import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';

import { MealPlanWizard } from './meal-plan.wizard';

function wizardBaseSegments(pathSegments: string[]): string[] {
  return pathSegments.slice(0, -1);
}

export const mealPlanWizardGuard: CanActivateChildFn = childRoute => {
  const router = inject(Router);
  const wizard = inject(MealPlanWizard);

  const childPath = childRoute.routeConfig?.path;
  if (!childPath || childPath === 'target') {
    return true;
  }

  const pathSegments = childRoute.pathFromRoot
    .flatMap(route => route.url.map(segment => segment.path))
    .filter(segment => segment.length > 0);
  const baseSegments = wizardBaseSegments(pathSegments);

  if (!wizard.target.valid) {
    return router.createUrlTree(['/', ...baseSegments, 'target']);
  }

  if ((childPath === 'preview' || childPath === 'shopping') && !wizard.hasSelectedMeals()) {
    return router.createUrlTree(['/', ...baseSegments, 'recipes']);
  }

  return true;
};

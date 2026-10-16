import { CanDeactivateFn } from '@angular/router';
import { MealPlannerPage } from '../planner/meal-planner.page';
/** Includes query/task changes and browser Back via runGuardsAndResolvers: always. */
export const mealPlanPendingChangesGuard: CanDeactivateFn<MealPlannerPage> =
  (page, _route, _state, next) => page.vm.canLeave(next?.url);

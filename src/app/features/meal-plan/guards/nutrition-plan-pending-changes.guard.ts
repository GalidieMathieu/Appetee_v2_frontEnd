import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { NutritionPlanFlowFacade } from '../state/nutrition-plan-flow.facade';

export const nutritionPlanPendingChangesGuard: CanDeactivateFn<unknown> = () => inject(NutritionPlanFlowFacade).canLeave();

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NutritionPlanFlowFacade } from '../state/nutrition-plan-flow.facade';
import { NutritionPlanStep, WIZARD_STEPS } from '../models/nutrition-plan-draft.model';
export const nutritionPlanWizardGuard: CanActivateFn = route => {
    const flow = inject(NutritionPlanFlowFacade);
    flow.startWizard();
    const step = route.paramMap.get('step') as NutritionPlanStep;
    return WIZARD_STEPS.includes(step) && flow.canVisit(step) ? true
        : inject(Router).createUrlTree(['/meal-plan/nutrition-plans/create/intermediate', flow.draftState.firstIncomplete()]);
};

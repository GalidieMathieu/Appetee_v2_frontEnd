import { Routes } from '@angular/router';

import { MealPlanShellPage } from './meal-plan-shell.page';
import { NutritionPlansPage } from './nutrition-plans/nutrition-plans.page';
import { NutritionPlansPageFacade } from './state/nutrition-plans-page.facade';
import { EasyPlanCreatePage } from './nutrition-plans/easy-plan-create.page';
import { NutritionPlanDraftState } from './state/nutrition-plan-draft.state';
import { NutritionPlanFlowFacade } from './state/nutrition-plan-flow.facade';
import { nutritionPlanPendingChangesGuard } from './guards/nutrition-plan-pending-changes.guard';
import { NutritionPlanWizardPage } from './nutrition-plans/nutrition-plan-wizard.page';
import { NutritionPlanEditPage } from './nutrition-plans/nutrition-plan-edit.page';
import { nutritionPlanWizardGuard } from './nutrition-plans/nutrition-plan-wizard.guard';
import { MealPlannerPage } from './planner/meal-planner.page';
import { MealPlanWorkspaceState } from './state/meal-plan-workspace.state';
import { MealPlanWorkspaceFacade } from './state/meal-plan-workspace.facade';
import { MealEditorDraftState } from './state/meal-editor-draft.state';
import { RecipePickerState } from './state/recipe-picker.state';
import { RecipePickerStore } from '@app/core/shared/data-access/recipes/picker/recipe-picker.store';
import { RecipePickerFacade } from '@app/core/shared/data-access/recipes/picker/recipe-picker.facade';
import { mealPlanPendingChangesGuard } from './guards/meal-plan-pending-changes.guard';
import { ManualItemDraftState } from './state/manual-item-draft.state';
import { MealPlanOrderingState } from './state/meal-plan-ordering.state';
import { CopyFlowState } from './state/copy-flow.state';

export const MEAL_PLAN_ROUTES: Routes = [
  {
    path: '',
    title: 'Meal Plan',
    component: MealPlanShellPage,
    children: [{ path: '', pathMatch: 'full', redirectTo: 'planner' }, {
      path: 'planner', title: 'Meal Planner', component: MealPlannerPage,
      providers: [MealPlanWorkspaceState, MealPlanWorkspaceFacade, MealEditorDraftState, ManualItemDraftState, MealPlanOrderingState, CopyFlowState, RecipePickerState, RecipePickerStore, RecipePickerFacade],
      canDeactivate: [mealPlanPendingChangesGuard], runGuardsAndResolvers: 'always',
    }, {
      path: 'nutrition-plans/create/intermediate', title: 'Create Intermediate plan', component: NutritionPlanWizardPage,
      providers: [NutritionPlanDraftState, NutritionPlanFlowFacade], canDeactivate: [nutritionPlanPendingChangesGuard],
      children: [{ path: '', pathMatch: 'full', redirectTo: 'profile' }, { path: ':step', canActivate: [nutritionPlanWizardGuard], children: [] }],
    }, {
      path: 'nutrition-plans/:planId/edit', title: 'Edit Nutrition Plan', component: NutritionPlanEditPage,
      providers: [NutritionPlanDraftState, NutritionPlanFlowFacade], canDeactivate: [nutritionPlanPendingChangesGuard],
    }, {
      path: 'nutrition-plans/create/easy', title: 'Create Easy plan', component: EasyPlanCreatePage,
      providers: [NutritionPlanDraftState, NutritionPlanFlowFacade],
      canDeactivate: [nutritionPlanPendingChangesGuard],
    }, {
      path: 'nutrition-plans', title: 'Nutrition Plans', component: NutritionPlansPage,
      providers: [NutritionPlansPageFacade],
    }],
  },
];

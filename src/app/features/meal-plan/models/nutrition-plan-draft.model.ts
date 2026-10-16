import { FormControl, FormGroup } from '@angular/forms';

/** Editable metadata only; saved entities and calculation data do not belong here. */
export interface NutritionPlanFormControls {
  name: FormControl<string>;
  defaultMealsPerDay: FormControl<number | null>;
}
export type NutritionPlanForm = FormGroup<NutritionPlanFormControls>;
export type NutritionPlanFieldErrors = Partial<Record<keyof NutritionPlanFormControls, readonly string[]>>;

export const WIZARD_STEPS = ['profile', 'goal', 'activity', 'meal-structure', 'review'] as const;
export type NutritionPlanStep = typeof WIZARD_STEPS[number];

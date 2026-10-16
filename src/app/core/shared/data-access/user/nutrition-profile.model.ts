import { MealPlanRevision } from '../meal-plan/meal-plan.model';

export type CalculationSex = 'male' | 'female';

export interface NutritionProfileValue {
  readonly calculationSex: CalculationSex;
  readonly birthYear: number;
  readonly heightCm: number;
  readonly weightKg: number;
}

export interface NutritionProfileRequest extends NutritionProfileValue {
  readonly adultConfirmed?: boolean;
}

export interface NutritionProfileDto {
  readonly revision: MealPlanRevision;
  readonly profile: NutritionProfileValue | null;
}


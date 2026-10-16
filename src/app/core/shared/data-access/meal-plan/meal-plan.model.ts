/** ISO-8601 local calendar date in YYYY-MM-DD form. */
export type MealPlanDate = string;

/** Opaque, non-negative decimal revision from the Meal Plan API. */
export type MealPlanRevision = string;

export type NutritionPlanMode = 'easy' | 'intermediate';

export interface NutrientsDto {
  readonly caloriesKcal: number | null;
  readonly proteinG: number | null;
  readonly carbsG: number | null;
  readonly fatG: number | null;
}

export interface CurrentNutritionPlanDto {
  readonly id: number;
  readonly name: string;
  readonly mode: NutritionPlanMode;
  readonly defaultMealsPerDay: number;
  readonly targets: NutrientsDto | null;
  readonly calculationPolicyVersion: string | null;
}

export interface MealPlanSettingsDto {
  readonly currentNutritionPlanId: number | null;
  readonly currentPlan: CurrentNutritionPlanDto | null;
}

export type PlannerDayPersistence = 'untouched' | 'saved';
export type RecipeAvailability = 'available' | 'unavailable';

export interface PlannerRecipeItemDto {
  readonly id: number;
  readonly type: 'recipe';
  readonly sortOrder: number;
  readonly recipeId: number;
  readonly quantity: number;
  readonly availability: RecipeAvailability;
  readonly name: string | null;
  readonly perServing: NutrientsDto | null;
  readonly nutrition: NutrientsDto;
  readonly warnings: readonly string[];
}

export interface PlannerManualItemDto {
  readonly id: number;
  readonly type: 'manual';
  readonly sortOrder: number;
  readonly name: string;
  readonly nutrition: NutrientsDto;
}

export type PlannerItemDto = PlannerRecipeItemDto | PlannerManualItemDto;

export interface PlannerMealDto {
  readonly id: number | null;
  readonly key: string;
  readonly isVirtual: boolean;
  readonly defaultSlot: number | null;
  readonly name: string;
  readonly sortOrder: number;
  readonly items: readonly PlannerItemDto[];
  readonly totals: NutrientsDto;
  readonly warnings: readonly string[];
}

export interface PlannerDayDto {
  readonly date: MealPlanDate;
  readonly id: number | null;
  readonly persistence: PlannerDayPersistence;
  readonly savedMealCount: number;
  readonly meals: readonly PlannerMealDto[];
  readonly totals: NutrientsDto;
  readonly targets: NutrientsDto | null;
  readonly remaining: NutrientsDto | null;
  readonly warnings: readonly string[];
}

export interface MealPlannerRangeDto {
  readonly revision: MealPlanRevision;
  readonly settings: MealPlanSettingsDto;
  readonly from: MealPlanDate;
  readonly through: MealPlanDate;
  readonly days: readonly PlannerDayDto[];
}


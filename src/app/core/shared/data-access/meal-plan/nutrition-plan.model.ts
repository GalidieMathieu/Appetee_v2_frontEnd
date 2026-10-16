import {
  MealPlanRevision,
  MealPlanSettingsDto,
  NutrientsDto,
  NutritionPlanMode,
} from './meal-plan.model';
import {
  NutritionProfileRequest,
  NutritionProfileValue,
} from '../user/nutrition-profile.model';

export type Goal =
  | 'performance'
  | 'maintain'
  | 'fatLoss'
  | 'muscleGain'
  | 'weightGain'
  | 'recomposition';

export type NutritionGoal = Goal;
export type Activity = 'inactive' | 'lowActive' | 'active' | 'veryActive';
export type ActivityLevel = Activity;

export interface CalculationInputsDto extends NutritionProfileValue {
  readonly ageYears: number;
  readonly goal: NutritionGoal;
  readonly activityLevel: ActivityLevel;
}

export interface NutritionCalculationRequest {
  readonly profile: NutritionProfileRequest;
  readonly goal: NutritionGoal;
  readonly activityLevel: ActivityLevel;
}

export interface NutritionCalculationDto {
  readonly policyVersion: string;
  readonly calculationYear: number;
  readonly inputs: CalculationInputsDto;
  readonly rmrKcal: number;
  readonly maintenanceKcal: number;
  readonly targets: NutrientsDto;
  readonly warnings: readonly string[];
}

export interface NutritionPlanSummaryDto {
  readonly id: number;
  readonly name: string;
  readonly mode: NutritionPlanMode;
  readonly defaultMealsPerDay: number;
  readonly goal: NutritionGoal | null;
  readonly activityLevel: ActivityLevel | null;
  readonly targets: NutrientsDto | null;
  readonly calculationPolicyVersion: string | null;
  readonly calculatedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NutritionPlanDto extends NutritionPlanSummaryDto {
  readonly calculationInputs: CalculationInputsDto | null;
  readonly rmrKcal: number | null;
  readonly maintenanceKcal: number | null;
  readonly warnings: readonly string[];
}

export interface NutritionPlanListDto {
  readonly revision: MealPlanRevision;
  readonly settings: MealPlanSettingsDto;
  readonly plans: readonly NutritionPlanSummaryDto[];
}

export interface NutritionPlanDetailDto {
  readonly revision: MealPlanRevision;
  readonly settings: MealPlanSettingsDto;
  readonly plan: NutritionPlanDto;
  readonly profileDiffers: boolean;
}

export interface NutritionPlanMutationDto {
  readonly revision: MealPlanRevision;
  readonly settings: MealPlanSettingsDto;
  readonly plan: NutritionPlanDto | null;
  readonly deletedPlanId: number | null;
  readonly profile: NutritionProfileValue | null;
  readonly plannerInvalidated: boolean;
}

interface NutritionPlanRequestBase {
  readonly name: string;
  readonly defaultMealsPerDay: number;
}

export interface CreateEasyNutritionPlanRequest extends NutritionPlanRequestBase {
  readonly mode: 'easy';
  readonly calculation?: never;
  readonly reviewedPolicyVersion?: never;
  readonly reviewedCalculationYear?: never;
}

export interface CreateIntermediateNutritionPlanRequest extends NutritionPlanRequestBase {
  readonly mode: 'intermediate';
  readonly calculation: NutritionCalculationRequest;
  readonly reviewedPolicyVersion: string;
  readonly reviewedCalculationYear: number;
}

export type CreateNutritionPlanRequest =
  | CreateEasyNutritionPlanRequest
  | CreateIntermediateNutritionPlanRequest;

export interface UpdateNutritionPlanMetadataRequest extends NutritionPlanRequestBase {
  readonly calculation?: never;
  readonly reviewedPolicyVersion?: never;
  readonly reviewedCalculationYear?: never;
}

export interface RecalculateNutritionPlanRequest extends NutritionPlanRequestBase {
  readonly calculation: NutritionCalculationRequest;
  readonly reviewedPolicyVersion: string;
  readonly reviewedCalculationYear: number;
}

export type UpdateNutritionPlanRequest =
  | UpdateNutritionPlanMetadataRequest
  | RecalculateNutritionPlanRequest;

export interface SetCurrentNutritionPlanRequest {
  readonly nutritionPlanId: number;
}

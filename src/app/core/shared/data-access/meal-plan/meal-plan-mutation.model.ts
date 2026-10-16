import {
  MealPlanDate,
  MealPlanRevision,
  MealPlanSettingsDto,
  PlannerDayDto,
} from './meal-plan.model';
import { Observable } from 'rxjs';
import { NutritionProfileDto } from '../user/nutrition-profile.model';
import { NutritionPlanMutationDto } from './nutrition-plan.model';

export const MEAL_PLAN_REVISION_HEADER = 'X-Meal-Plan-Revision';

export type MealPlanMutationKind =
  | 'createMeal'
  | 'renameMeal'
  | 'deleteMeal'
  | 'reorderMeals'
  | 'addRecipeItem'
  | 'setRecipeQuantity'
  | 'addManualItem'
  | 'updateManualItem'
  | 'deleteItem'
  | 'reorderItems'
  | 'copyDay'
  | 'copyWeek'
  | 'createNutritionPlan'
  | 'updateNutritionPlan'
  | 'duplicateNutritionPlan'
  | 'deleteNutritionPlan'
  | 'setCurrentNutritionPlan'
  | 'updateNutritionProfile';

export type MealTargetRequest =
  | { readonly mealId: number; readonly defaultSlot?: never }
  | { readonly mealId?: never; readonly defaultSlot: number };

export interface CreateMealRequest {
  readonly name: string;
  readonly defaultSlot?: number;
}

export interface RenameMealRequest {
  readonly name: string;
}

export interface AddRecipeItemRequest {
  readonly meal: MealTargetRequest;
  readonly recipeId: number;
  readonly quantity: number;
}

export interface SetRecipeQuantityRequest {
  readonly quantity: number;
}

export interface ManualItemRequest {
  readonly name: string;
  readonly caloriesKcal: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
}

export interface AddManualItemRequest {
  readonly meal: MealTargetRequest;
  readonly manualItem: ManualItemRequest;
}

export interface ReorderRequest {
  readonly orderedIds: readonly number[];
}

export interface CopyDayRequest {
  readonly sourceDate: MealPlanDate;
  readonly destinationDate: MealPlanDate;
  readonly replaceExisting: boolean;
}

export interface CopyWeekRequest {
  readonly sourceMonday: MealPlanDate;
  readonly destinationMonday: MealPlanDate;
  readonly replaceExisting: boolean;
}

export interface PlannerMutationDto {
  readonly revision: MealPlanRevision;
  readonly settings: MealPlanSettingsDto;
  readonly days: readonly PlannerDayDto[];
  readonly createdMealId: number | null;
  readonly createdItemId: number | null;
}

export type MealPlanMutationStatus =
  | 'idle'
  | 'pending'
  | 'failed'
  | 'conflict'
  | 'unknownOutcome';

export interface MealPlanMutationContext {
  readonly kind: MealPlanMutationKind;
  readonly expectedRevision: MealPlanRevision;
  readonly date?: MealPlanDate;
  readonly mealId?: number;
  readonly itemId?: number;
}

export type MealPlanMutationReceipt =
  | PlannerMutationDto
  | NutritionPlanMutationDto
  | NutritionProfileDto;

export type MealPlanOperationMode = 'scalar' | 'structural';

export interface MealPlanMutationOperation {
  readonly context: MealPlanMutationContext;
  readonly mode: MealPlanOperationMode;
  /** Stable domain resource identity, for example item:30 or plan:4. */
  readonly resourceKey: string;
  /** Required for coalescible scalar edits; later unsent values replace earlier ones. */
  readonly coalesceKey?: string;
  /** Structural intents with the same key are accepted only once while outstanding. */
  readonly dedupeKey?: string;
  /** Queued work is cancelled if a confirmed earlier operation deletes one of these keys. */
  readonly dependsOn?: readonly string[];
  readonly deletesResourceKeys?: readonly string[];
  /** Core-facade-owned execution; it must not capture components, forms or Router state. */
  readonly execute: (expectedRevision: MealPlanRevision) => Observable<MealPlanMutationReceipt>;
}

export type MealPlanOperationOutcome =
  | 'confirmed'
  | 'failed'
  | 'conflict'
  | 'unknownOutcome'
  | 'superseded'
  | 'duplicate'
  | 'cancelled';

export interface MealPlanOperationResult {
  readonly operationId: number;
  readonly kind: MealPlanMutationKind;
  readonly outcome: MealPlanOperationOutcome;
  readonly revision: MealPlanRevision | null;
  readonly httpStatus?: number;
  readonly code?: string;
}

/** Planner command metadata delivered only after the atomic receipt is synchronized. */
export interface PlannerOperationResult extends MealPlanOperationResult {
  readonly createdMealId: number | null;
  readonly createdItemId: number | null;
  readonly traceId?: string;
  readonly errors?: Readonly<Record<string, readonly string[]>>;
}

import {
  RecipeDifficulty,
  RecipeSummary,
} from '@app/core/shared/data-access/recipes/recipe.model';

export type MealPlanBadge = 'freezer-friendly' | 'budget-focused' | 'high protein';
export type MealPlanChangeState = 'kept' | 'updated' | 'needs-replacement';
export type MealPlanSuggestionSort =
  | 'cheapest'
  | 'highest-protein'
  | 'freezer-friendly'
  | 'easiest'
  | 'fastest';

export interface MealPlanTarget {
  name: string;
  durationDays: number;
  mealsPerDay: number;
  caloriesPerDay: number;
  proteinPerDay: number;
  dietIds: number[];
  ingredientRestrictionIds: number[];
  maxPrepTimeMinutes: number | null;
  difficulty: RecipeDifficulty | null;
  freezerFriendlyOnly: boolean;
}

export interface MealPlanRecipeSelection {
  recipeId: number;
  portions: number;
  frequencyPerWeek: number;
}

export interface MealPlanSelectionSnapshot extends MealPlanRecipeSelection {}

export interface MealPlanSelectedMeal {
  recipe: RecipeSummary;
  portions: number;
  frequencyPerWeek: number;
  changeState: MealPlanChangeState;
  conflictReasons: string[];
}

export interface MealPlanPreview {
  averageCaloriesPerDay: number;
  averageProteinPerDay: number;
  estimatedTotalBudget: number;
  estimatedBudgetPerWeek: number;
  freezerCompatibilitySummary: string;
  totalMealsCovered: number;
  rotationSummary: string;
  warnings: string[];
}

export interface MealPlanShoppingItem {
  group: string;
  ingredientName: string;
  quantityRequired: number;
  quantityUnit: string;
  quantityRequiredLabel: string;
  walmartProductLink: string | null;
  estimatedItemPrice: number | null;
  estimatedQuantityToBuy: number;
  packageLabel: string;
}

export interface MealPlanShoppingGroup {
  group: string;
  items: MealPlanShoppingItem[];
}

export interface MealPlanCalculation {
  selectedMeals: MealPlanSelectedMeal[];
  preview: MealPlanPreview;
  shoppingList: MealPlanShoppingGroup[];
  badges: MealPlanBadge[];
}

export interface MealPlanCard {
  id: number;
  name: string;
  durationDays: number;
  mealsPerDay: number;
  caloriesPerDay: number;
  proteinPerDay: number;
  estimatedTotalPrice: number;
  lastUpdated: string;
  badges: MealPlanBadge[];
}

export interface MealPlanDetail extends MealPlanCard {
  target: MealPlanTarget;
  selectedMeals: MealPlanSelectedMeal[];
  preview: MealPlanPreview;
  shoppingList: MealPlanShoppingGroup[];
}

export interface MealPlanDraftInput {
  id?: number;
  target: MealPlanTarget;
  selectedMeals: MealPlanRecipeSelection[];
}

export interface MealPlanPreviewRequest {
  target: MealPlanTarget;
  selectedMeals: MealPlanRecipeSelection[];
  previousSelections: MealPlanSelectionSnapshot[];
}

export interface MealPlanSaveRequest extends MealPlanPreviewRequest {
  id?: number;
}

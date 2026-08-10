import { Diet } from '../diets/diet.model';
import { Ingredient, IngredientAdminDetailDto } from '../ingredients/ingredient.model';

//########## Shared ############
export type RecipeDifficulty = 'Easy' | 'Medium' | 'Hard';
export type RecipeBadge = 'freezer-friendly' | 'budget-focused' | 'high-protein';

export interface RecipeNutrition {
  caloriesTotal: number;
  proteinTotal: number;
  carbsTotal: number;
}

export interface RecipeInstructionStep {
  title: string;
  instruction: string;
}

//########## DTO ############
/** Lightweight projection owned by recipe query/list state. */
export interface RecipeCardDto extends RecipeNutrition {
  id: number;
  name: string;
  imageUrl: string | null;
  prepTimeMinutes: number;
  servings: number;
  difficulty: RecipeDifficulty;
  badges: RecipeBadge[] | null;
  diets: Diet[] | null;
  estimatedCostPerServing: number | null;
  ingredients: Ingredient[];
}

/** @deprecated Prefer RecipeCardDto for list/card responses. */
export type RecipeSummary = RecipeCardDto;

export interface RecipeIngredientDetailDto {
  ingredientId: number;
  quantity: number | null;
  unit: string | null;
  ingredient: IngredientAdminDetailDto;
}

export interface RecipeDetailDto extends Omit<RecipeCardDto, 'ingredients'> {
  instructions: RecipeInstructionStep[];
  ingredients: RecipeIngredientDetailDto[];
}

//########## Request ############
export interface RecipeIngredientRequest {
  ingredientId: number;
  quantity: number | null;
  unit: string | null;
}

export interface RecipeDetailRequest {
  name: string;
  image: File | null;
  instructions: RecipeInstructionStep[];
  prepTimeMinutes: number;
  servings: number;
  difficulty: RecipeDifficulty;
  badges: RecipeBadge[];
  dietIds: number[];
  ingredients: RecipeIngredientRequest[];
}

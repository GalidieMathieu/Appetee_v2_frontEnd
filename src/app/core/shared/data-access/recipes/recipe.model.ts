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

//########## DTO ############
export interface RecipeSummary extends RecipeNutrition {
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

export interface RecipeIngredientDetailDto {
  ingredientId: number;
  quantity: number | null;
  unit: string | null;
  ingredient: IngredientAdminDetailDto;
}

export interface RecipeDetailDto extends Omit<RecipeSummary, 'ingredients'> {
  instructions: string[];
  ingredients: RecipeIngredientDetailDto[];
}

//########## Request ############
export interface RecipeIngredientRequest {
  ingredientId: number;
  quantity: number | null;
  unit: string | null;
}

export interface RecipeDetailRequest extends RecipeNutrition {
  name: string;
  image: File | null;
  instructions: string;
  prepTimeMinutes: number;
  servings: number;
  difficulty: RecipeDifficulty;
  badges: RecipeBadge[];
  dietIds: number[];
  estimatedCostPerServing: number | null;
  ingredients: RecipeIngredientRequest[];
}

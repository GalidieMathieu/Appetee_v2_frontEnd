import { Diet } from '../diets/diet.model';
import { Ingredient, IngredientAdminDetailDto } from '../ingredients/ingredient.model';

//########## Shared ############
export type RecipeDifficulty = 'Easy' | 'Medium' | 'Hard';

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
  diets: Diet[] | null;
  freezerFriendly: boolean;
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
  image: File;
  instructions: string[];
  prepTimeMinutes: number;
  servings: number;
  difficulty: RecipeDifficulty;
  dietIds: number[];
  freezerFriendly: boolean;
  estimatedCostPerServing: number | null;
  ingredients: RecipeIngredientRequest[];
}

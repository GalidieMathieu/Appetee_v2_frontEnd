import { Diet } from '../diets/diet.model';
import { Ingredient, IngredientAdminDetailDto } from '../ingredients/ingredient.model';

export type RecipeDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface RecipeNutrition {
  caloriesTotal: number;
  proteinTotal: number;
  carbsTotal: number;
  fatsTotal: number;
}

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

export type RecipeDetailDto = Omit<RecipeSummary, 'ingredients'> & {
  instructions: string[];
  ingredients: IngredientAdminDetailDto[];
};

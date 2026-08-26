import { FormArray, FormControl, FormGroup } from '@angular/forms';

import {
  IngredientAdminDetailDto,
  IngredientDialogResult,
} from '@app/core/shared/data-access/ingredients/ingredient.model';
import {
  RecipeDetailRequest,
  RecipeBadge,
  RecipeDifficulty,
  RecipeFeaturedOrder,
  RecipeInstructionStep,
  RecipeNutrition,
  RecipePerServingNutrition,
} from '@app/core/shared/data-access/recipes/recipe.model';

//########## Page ############
export type RecipeCreationForm = FormGroup<{
  name: FormControl<string>;
  description: FormControl<string>;
  image: FormControl<File | null>;
  instructions: FormArray<RecipeInstructionStepForm>;
  servings: FormControl<number>;
  prepTimeMinutes: FormControl<number>;
  cookTimeMinutes: FormControl<number>;
  totalTimeMinutes: FormControl<number>;
  difficulty: FormControl<RecipeDifficulty | null>;
  badges: FormControl<RecipeBadge[]>;
  dietIds: FormControl<number[]>;
}>;

export type RecipeInstructionStepForm = FormGroup<{
  title: FormControl<string>;
  instruction: FormControl<string>;
}>;

export type RecipeInstructionStepDraft = Partial<RecipeInstructionStep>;

export type RecipeCreationIngredient = IngredientDialogResult & {
  ingredient: IngredientAdminDetailDto;
  featuredOrder: RecipeFeaturedOrder | null;
};

export type RecipeCalculation = RecipeNutrition & RecipePerServingNutrition & {
  estimatedCostPerServing: number | null;
};

export const EMPTY_RECIPE_CALCULATION: RecipeCalculation = {
  caloriesTotal: 0,
  proteinTotal: 0,
  carbsTotal: 0,
  caloriesPerServing: 0,
  proteinPerServing: 0,
  estimatedCostPerServing: null,
};

export type RecipeCreationRequestPreview = RecipeDetailRequest;

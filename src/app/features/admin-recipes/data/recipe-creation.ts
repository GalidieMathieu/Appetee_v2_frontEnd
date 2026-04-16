import { FormControl, FormGroup } from '@angular/forms';

import {
  IngredientAdminDetailDto,
  IngredientDialogResult,
} from '@app/core/shared/data-access/ingredients/ingredient.model';
import {
  RecipeDetailRequest,
  RecipeDifficulty,
} from '@app/core/shared/data-access/recipes/recipe.model';

//########## Page ############
export type RecipeCreationForm = FormGroup<{
  name: FormControl<string>;
  image: FormControl<File | null>;
  instructions: FormControl<string>;
  servings: FormControl<number>;
  prepTimeMinutes: FormControl<number>;
  difficulty: FormControl<RecipeDifficulty | null>;
  freezerFriendly: FormControl<boolean>;
  dietIds: FormControl<number[]>;
}>;

export type RecipeCreationIngredient = IngredientDialogResult & {
  ingredient: IngredientAdminDetailDto;
};

export type RecipeCreationRequestPreview = RecipeDetailRequest;

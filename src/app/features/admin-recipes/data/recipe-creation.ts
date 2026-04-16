import { FormControl, FormGroup } from '@angular/forms';

import {
  IngredientAdminDetailDto,
  IngredientDialogResult,
} from '@app/core/shared/data-access/ingredients/ingredient.model';

export type RecipeCreationForm = FormGroup<{
  name: FormControl<string>;
  image: FormControl<File | null>;
  instructions: FormControl<string>;
}>;

export type RecipeCreationIngredient = IngredientDialogResult & {
  ingredient: IngredientAdminDetailDto;
};

export type RecipeCreationRequestPreview = {
  name: string;
  image: File | null;
  instructions: string[];
  ingredients: Array<{
    ingredientId: number;
    quantity: number | null;
    unit: string | null;
  }>;
};

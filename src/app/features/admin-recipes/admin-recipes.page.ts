import { Component, inject } from '@angular/core';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { RouterLink } from '@angular/router';
import { IngredientDialogComponent } from './component/ingredient-creation.dialog';


//---------------------------------------------------------------------
//-------------- Type for the Form for better readable ----------------
export type RecipeIngredientForm = FormGroup<{
  ingredientId: FormControl<number | null>;
  ingredientName: FormControl<string>;
  quantity: FormControl<number | null>;
  unit: FormControl<string | null>;
  calories: FormControl<number | null>;
  protein: FormControl<number | null>;
  fat: FormControl<number | null>;
  walmartProductId: FormControl<string | null>;
  walmartProductName: FormControl<string | null>;
}>;

export type CreateRecipeForm = FormGroup<{
  name: FormControl<string>;
  imageUrl: FormControl<string>;
  instructions: FormControl<string>;
  ingredients: FormArray<RecipeIngredientForm>;
}>;

@Component({
  selector: 'app-admin-recipe-page',
  templateUrl: './admin-recipes.page.html',
  styleUrls: ['./admin-recipes.page.scss'],
  standalone: true,
  imports: [MatDialogModule],
})
export class AdminRecipesPageComponent 
{
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly dialog = inject(MatDialog);

  openIngredientDialog(): void { 
    const dialogRef = this.dialog.open(IngredientDialogComponent);

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;
      // handle result
    });
  }


}

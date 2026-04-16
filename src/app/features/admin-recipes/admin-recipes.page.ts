import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { IngredientsFacade } from '@app/core/shared/data-access/ingredients/ingredient.facade';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { readAvifFileSelection } from '@app/core/shared/utils/avif-file-selection/avif-file-selection';

import {
  RecipeCreationForm,
  RecipeCreationIngredient,
  RecipeCreationRequestPreview,
} from './data/recipe-creation';
import { IngredientDialogComponent } from './component/ingredient-creation.dialog';

@Component({
  selector: 'app-admin-recipe-page',
  templateUrl: './admin-recipes.page.html',
  styleUrls: ['./admin-recipes.page.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule],
})
export class AdminRecipesPageComponent implements OnDestroy {
  //##################### Dependencies #################
  private readonly dialog = inject(MatDialog);
  private readonly ingredientsFacade = inject(IngredientsFacade);
  private readonly recipesFacade = inject(RecipesFacade);

  //##################### Page State #################
  protected previewImageUrl: string | null = null;
  protected selectedImageName = '';
  protected ingredients: RecipeCreationIngredient[] = [];

  //##################### Recipe Form #################
  readonly form: RecipeCreationForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    image: new FormControl<File | null>(null, {
      validators: [Validators.required],
    }),
    instructions: new FormControl('', { nonNullable: true }),
  });

  // Releases the local image preview when the page is destroyed.
  ngOnDestroy(): void {
    this.clearPreviewImage();
  }

  // Builds the recipe title shown in the summary card.
  get recipeName(): string {
    return this.form.controls.name.value.trim() || 'Unnamed Recipe';
  }

  // Exposes the number of selected ingredients for the summary card.
  get ingredientCount(): number {
    return this.ingredients.length;
  }

  // Formats the ingredient count label shown in the summary.
  get ingredientLabel(): string {
    return `${this.ingredientCount} Ingredient${this.ingredientCount === 1 ? '' : 's'}`;
  }

  // Calculates the total recipe calories from loaded ingredient details.
  get totalCalories(): number {
    return this.getNutritionTotal('caloriesKcal');
  }

  // Calculates the total recipe protein from loaded ingredient details.
  get totalProtein(): number {
    return this.getNutritionTotal('proteinG');
  }

  // Calculates the total recipe fat from loaded ingredient details.
  get totalFat(): number {
    return this.getNutritionTotal('fatG');
  }

  // Opens the ingredient dialog and loads full DTO details for the selected id.
  openIngredientDialog(): void {
    const dialogRef = this.dialog.open(IngredientDialogComponent);

    dialogRef.afterClosed().subscribe(result => {
      if (!result) {
        return;
      }

      this.ingredientsFacade.getIngredientWithDetails(result.ingredientId).subscribe(ingredient => {
        this.ingredients = [
          ...this.ingredients,
          {
            ...result,
            ingredient,
          },
        ];
      });
    });
  }

  // Removes one selected ingredient from the recipe draft.
  removeIngredient(index: number): void {
    this.ingredients = this.ingredients.filter((_, currentIndex) => currentIndex !== index);
  }

  // Validates the chosen AVIF image and creates a local preview URL.
  onImageSelected(event: Event): void {
    const selection = readAvifFileSelection(event);

    if (selection.kind === 'empty') {
      this.clearSelectedImage();
      return;
    }

    if (selection.kind === 'invalid-type') {
      this.clearSelectedImage();
      this.form.controls.image.setErrors({ invalidFileType: true });
      this.form.controls.image.markAsTouched();
      if (selection.input) {
        selection.input.value = '';
      }
      return;
    }

    this.clearPreviewImage();

    this.selectedImageName = selection.file.name;
    this.previewImageUrl = URL.createObjectURL(selection.file);
    this.form.controls.image.setValue(selection.file);
    this.form.controls.image.markAsDirty();
    this.form.controls.image.updateValueAndValidity();
  }

  // Validates the page form and prepares the future facade save payload.
  saveRecipe(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const recipeRequest = this.buildRecipeRequest();
    if (!recipeRequest) {
      return;
    }

    void recipeRequest;
    void this.recipesFacade;

    // this.recipesFacade.createRecipe(recipeRequest).subscribe();
  }

  // Converts the page state into the future recipe creation request shape.
  private buildRecipeRequest(): RecipeCreationRequestPreview | null {
    const value = this.form.getRawValue();

    if (!value.image) {
      this.form.controls.image.setErrors({ required: true });
      this.form.controls.image.markAsTouched();
      return null;
    }

    return {
      name: value.name.trim(),
      image: value.image,
      instructions: value.instructions
        .split(/\r?\n/)
        .map(step => step.trim())
        .filter(step => step.length > 0),
      ingredients: this.ingredients.map(ingredient => ({
        ingredientId: ingredient.ingredientId,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      })),
    };
  }

  // Aggregates one nutrition metric across all selected ingredients.
  private getNutritionTotal(
    key: 'caloriesKcal' | 'proteinG' | 'fatG'
  ): number {
    const total = this.ingredients.reduce((sum, ingredient) => {
      const quantity = ingredient.quantity ?? ingredient.ingredient.basis;
      const basis = ingredient.ingredient.basis || 1;
      const nutrientValue = ingredient.ingredient[key] ?? 0;

      return sum + nutrientValue * (quantity / basis);
    }, 0);

    return Math.round(total);
  }

  // Clears the selected image from both the form and preview state.
  private clearSelectedImage(): void {
    this.clearPreviewImage();
    this.selectedImageName = '';
    this.form.controls.image.setValue(null);
    this.form.controls.image.updateValueAndValidity();
  }

  // Revokes the generated object URL to avoid leaking browser memory.
  private clearPreviewImage(): void {
    if (this.previewImageUrl) {
      URL.revokeObjectURL(this.previewImageUrl);
      this.previewImageUrl = null;
    }
  }
}

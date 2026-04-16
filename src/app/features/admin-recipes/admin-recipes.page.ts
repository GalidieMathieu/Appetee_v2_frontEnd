import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { startWith, filter, map, switchMap } from 'rxjs';

import { Diet } from '@app/core/shared/data-access/diets/diet.model';
import { DietsFacade } from '@app/core/shared/data-access/diets/diets.facade';
import { IngredientsFacade } from '@app/core/shared/data-access/ingredients/ingredient.facade';
import { IngredientDialogResult } from '@app/core/shared/data-access/ingredients/ingredient.model';
import {
  RecipeDetailRequest,
  RecipeDifficulty,
  RecipeNutrition,
} from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { readAvifFileSelection } from '@app/core/shared/utils/avif-file-selection/avif-file-selection';

import {
  RecipeCreationForm,
  RecipeCreationIngredient,
} from './data/recipe-creation';
import { IngredientDialogComponent } from './component/ingredient-creation.dialog';

//########## Page Validation ############
const requiredTrimmedValidator: ValidatorFn = (
  control: AbstractControl<string | null>
): ValidationErrors | null => {
  const value = control.value;

  if (typeof value !== 'string') {
    return { requiredTrimmed: true };
  }

  return value.trim().length > 0 ? null : { requiredTrimmed: true };
};

@Component({
  selector: 'app-admin-recipe-page',
  templateUrl: './admin-recipes.page.html',
  styleUrls: ['./admin-recipes.page.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule],
})
export class AdminRecipesPageComponent implements OnInit, OnDestroy {
  //########## Page Options ############
  readonly difficultyOptions: RecipeDifficulty[] = ['Easy', 'Medium', 'Hard'];

  //########## Dependencies ############
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dietsFacade = inject(DietsFacade);
  private readonly ingredientsFacade = inject(IngredientsFacade);
  private readonly recipesFacade = inject(RecipesFacade);

  //########## Page State ############
  protected previewImageUrl: string | null = null;
  protected selectedImageName = '';
  protected readonly ingredients = signal<RecipeCreationIngredient[]>([]);
  protected readonly submitAttempted = signal(false);
  protected readonly hasIngredientsError = computed(
    () => this.submitAttempted() && this.ingredients().length === 0
  );
  protected readonly errorMessage = toSignal(this.recipesFacade.error$, { initialValue: null });
  protected readonly isSaving = toSignal(this.recipesFacade.isLoading$, { initialValue: false });

  //########## Page Form ############
  readonly form: RecipeCreationForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [requiredTrimmedValidator],
    }),
    image: new FormControl<File | null>(null, {
      validators: [Validators.required],
    }),
    instructions: new FormControl('', {
      nonNullable: true,
      validators: [requiredTrimmedValidator],
    }),
    servings: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    prepTimeMinutes: new FormControl(15, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    difficulty: new FormControl<RecipeDifficulty | null>('Medium', {
      validators: [Validators.required],
    }),
    freezerFriendly: new FormControl(false, {
      nonNullable: true,
    }),
    dietIds: new FormControl<number[]>([], {
      nonNullable: true,
    }),
  });

  readonly diets = toSignal(this.dietsFacade.diets$, {
    initialValue: [] as Diet[],
  });
  readonly selectedDietIds = toSignal(
    this.form.controls.dietIds.valueChanges.pipe(startWith(this.form.controls.dietIds.value)),
    { initialValue: this.form.controls.dietIds.value }
  );
  readonly selectedDiets = computed(() => {
    const ids = new Set(this.selectedDietIds());
    return this.diets().filter(diet => ids.has(diet.id));
  });

  get nameControl(): FormControl<string> {
    return this.form.controls.name;
  }

  get imageControl(): FormControl<File | null> {
    return this.form.controls.image;
  }

  get instructionsControl(): FormControl<string> {
    return this.form.controls.instructions;
  }

  get servingsControl(): FormControl<number> {
    return this.form.controls.servings;
  }

  get prepTimeMinutesControl(): FormControl<number> {
    return this.form.controls.prepTimeMinutes;
  }

  get difficultyControl(): FormControl<RecipeDifficulty | null> {
    return this.form.controls.difficulty;
  }

  // Loads supporting option data used by the create form.
  ngOnInit(): void {
    this.dietsFacade.loadIfNeeded();
  }

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
    return this.ingredients().length;
  }

  // Formats the ingredient count label shown in the summary.
  get ingredientLabel(): string {
    return `${this.ingredientCount} Ingredient${this.ingredientCount === 1 ? '' : 's'}`;
  }

  // Exposes the selected servings count for the summary card.
  get servingsValue(): number {
    return this.form.controls.servings.value;
  }

  // Exposes the prep time for the summary card.
  get prepTimeMinutesValue(): number {
    return this.form.controls.prepTimeMinutes.value;
  }

  // Exposes the selected difficulty label for the summary card.
  get difficultyValue(): RecipeDifficulty | null {
    return this.form.controls.difficulty.value;
  }

  // Calculates the total recipe calories from loaded ingredient details.
  get totalCalories(): number {
    return Math.round(this.calculateRecipeNutrition().caloriesTotal);
  }

  // Calculates the total recipe protein from loaded ingredient details.
  get totalProtein(): number {
    return Math.round(this.calculateRecipeNutrition().proteinTotal);
  }

  // Calculates the total recipe carbs from loaded ingredient details.
  get totalCarbs(): number {
    return Math.round(this.calculateRecipeNutrition().carbsTotal);
  }

  // Estimates the cost per serving from the linked ingredient prices.
  get estimatedCostPerServing(): number | null {
    return this.calculateEstimatedCostPerServing(this.servingsValue);
  }

  // Opens the ingredient dialog and loads full DTO details for the selected id.
  openIngredientDialog(): void {
    const dialogRef = this.dialog.open(IngredientDialogComponent);

    dialogRef.afterClosed().pipe(
      filter((result): result is IngredientDialogResult => result != null),
      switchMap(result =>
        this.ingredientsFacade.getIngredientWithDetails(result.ingredientId).pipe(
          map(ingredient => ({
            ...result,
            ingredient,
          }))
        )
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(recipeIngredient => {
      this.ingredients.update(ingredients => [...ingredients, recipeIngredient]);
    });
  }

  // Removes one selected ingredient from the recipe draft.
  removeIngredient(index: number): void {
    this.ingredients.update(ingredients =>
      ingredients.filter((_, currentIndex) => currentIndex !== index)
    );
  }

  // Toggles one diet tag on the recipe.
  toggleDiet(id: number): void {
    const control = this.form.controls.dietIds;
    const current = control.value;
    control.setValue(current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
    control.markAsDirty();
    control.markAsTouched();
  }

  // Reports whether a diet tile is selected.
  isDietSelected(id: number): boolean {
    return this.form.controls.dietIds.value.includes(id);
  }

  // Toggles the selected recipe difficulty.
  setDifficulty(difficulty: RecipeDifficulty): void {
    const control = this.form.controls.difficulty;
    control.setValue(control.value === difficulty ? null : difficulty);
    control.markAsDirty();
    control.markAsTouched();
  }

  // Reports whether a difficulty tile is selected.
  isDifficultySelected(difficulty: RecipeDifficulty): boolean {
    return this.form.controls.difficulty.value === difficulty;
  }

  // Sets whether the recipe is intended to freeze well.
  setFreezerFriendly(value: boolean): void {
    const control = this.form.controls.freezerFriendly;
    control.setValue(value);
    control.markAsDirty();
    control.markAsTouched();
  }

  // Reports whether the freezer-friendly option matches the current selection.
  isFreezerFriendlySelected(value: boolean): boolean {
    return this.form.controls.freezerFriendly.value === value;
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

  // Validates the page form and submits the recipe create request.
  saveRecipe(): void {
    this.submitAttempted.set(true);
    this.form.markAllAsTouched();

    if (this.form.invalid || this.ingredients().length === 0) {
      return;
    }

    const recipeRequest = this.buildRecipeRequest();
    if (!recipeRequest) {
      return;
    }

    this.recipesFacade.createRecipeWithDetails(recipeRequest).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }

  // Converts the page state into the recipe detail request shape used by the facade.
  private buildRecipeRequest(): RecipeDetailRequest | null {
    const value = this.form.getRawValue();

    if (!value.image) {
      this.form.controls.image.setErrors({ required: true });
      this.form.controls.image.markAsTouched();
      return null;
    }

    const name = value.name.trim();
    const instructions = value.instructions
      .split(/\r?\n/)
      .map(step => step.trim())
      .filter(step => step.length > 0);

    if (!name) {
      this.form.controls.name.setErrors({ requiredTrimmed: true });
      this.form.controls.name.markAsTouched();
      return null;
    }

    if (instructions.length === 0) {
      this.form.controls.instructions.setErrors({ requiredTrimmed: true });
      this.form.controls.instructions.markAsTouched();
      return null;
    }

    if (!value.difficulty) {
      this.form.controls.difficulty.setErrors({ required: true });
      this.form.controls.difficulty.markAsTouched();
      return null;
    }

    if (this.ingredients().length === 0) {
      return null;
    }

    const nutrition = this.calculateRecipeNutrition();

    return {
      ...nutrition,
      name,
      image: value.image,
      instructions,
      prepTimeMinutes: value.prepTimeMinutes,
      servings: value.servings,
      difficulty: value.difficulty,
      dietIds: value.dietIds,
      freezerFriendly: value.freezerFriendly,
      estimatedCostPerServing: this.calculateEstimatedCostPerServing(value.servings),
      ingredients: this.ingredients().map(ingredient => ({
        ingredientId: ingredient.ingredientId,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      })),
    };
  }

  // Aggregates the recipe nutrition totals from each selected ingredient quantity.
  private calculateRecipeNutrition(): RecipeNutrition {
    const totals = this.ingredients().reduce(
      (sum, ingredient) => {
        const factor = this.getIngredientQuantityFactor(ingredient);
        const detail = ingredient.ingredient;

        return {
          caloriesTotal: sum.caloriesTotal + detail.caloriesKcal * factor,
          proteinTotal: sum.proteinTotal + (detail.proteinG ?? 0) * factor,
          carbsTotal: sum.carbsTotal + (detail.carbsG ?? 0) * factor,
        };
      },
      {
        caloriesTotal: 0,
        proteinTotal: 0,
        carbsTotal: 0,
      }
    );

    return {
      caloriesTotal: this.roundTo(totals.caloriesTotal, 2),
      proteinTotal: this.roundTo(totals.proteinTotal, 2),
      carbsTotal: this.roundTo(totals.carbsTotal, 2),
    };
  }

  // Estimates the recipe cost per serving from ingredient prices when available.
  private calculateEstimatedCostPerServing(servings: number): number | null {
    if (servings <= 0 || this.ingredients().length === 0) {
      return null;
    }

    let totalCost = 0;

    for (const recipeIngredient of this.ingredients()) {
      if (recipeIngredient.ingredient.price === null) {
        return null;
      }

      totalCost += recipeIngredient.ingredient.price * this.getIngredientQuantityFactor(recipeIngredient);
    }

    return this.roundTo(totalCost / servings, 2);
  }

  // Converts one selected ingredient quantity into a scale factor relative to its nutrition basis.
  private getIngredientQuantityFactor(ingredient: RecipeCreationIngredient): number {
    const quantity = ingredient.quantity ?? ingredient.ingredient.basis;
    const basis = ingredient.ingredient.basis || 1;

    return quantity / basis;
  }

  // Rounds floating point output to keep request payloads stable and readable.
  private roundTo(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
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

  protected shouldShowControlError(control: AbstractControl): boolean {
    return control.invalid && (control.touched || this.submitAttempted());
  }
}

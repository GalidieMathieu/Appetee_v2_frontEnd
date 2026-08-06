import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { defaultIfEmpty, finalize, of, startWith, filter, map, switchMap, tap } from 'rxjs';

import { Diet } from '@app/core/shared/data-access/diets/diet.model';
import { DietsFacade } from '@app/core/shared/data-access/diets/diets.facade';
import { IngredientsFacade } from '@app/core/shared/data-access/ingredients/ingredient.facade';
import { IngredientDialogResult } from '@app/core/shared/data-access/ingredients/ingredient.model';
import {
  RecipeBadge,
  RecipeDetailDto,
  RecipeDetailRequest,
  RecipeDifficulty,
  RecipeNutrition,
  RecipeSummary,
} from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { readAvifFileSelection } from '@app/core/shared/utils/avif-file-selection/avif-file-selection';

import {
  RecipeCreationForm,
  RecipeCreationIngredient,
} from './data/recipe-creation';
import { IngredientDialogComponent } from './component/ingredient-creation.dialog';
import {
  RecipeFeedbackDialogComponent,
  RecipeFeedbackDialogData,
} from './component/recipe-feedback.dialog';

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
  readonly badgeOptions: ReadonlyArray<{ value: RecipeBadge; label: string }> = [
    { value: 'freezer-friendly', label: 'Freezer-friendly' },
    { value: 'budget-focused', label: 'Budget-focused' },
    { value: 'high-protein', label: 'High-protein' },
  ];

  //########## Dependencies ############
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dietsFacade = inject(DietsFacade);
  private readonly ingredientsFacade = inject(IngredientsFacade);
  private readonly recipesFacade = inject(RecipesFacade);

  //########## Page State ############
  protected previewImageUrl: string | null = null;
  private previewImageObjectUrl: string | null = null;
  protected selectedImageName = '';
  protected readonly ingredients = signal<RecipeCreationIngredient[]>([]);
  protected readonly submitAttempted = signal(false);
  private readonly routeId = toSignal(
    this.route.paramMap.pipe(map(paramMap => paramMap.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') }
  );
  protected readonly isEditRecipeLoading = signal(false);
  protected readonly isEditRecipeReady = signal(false);
  protected readonly editRecipeLoadError = signal<string | null>(null);
  protected readonly isEditMode = computed(() => this.editRecipeId() !== null);
  protected readonly pageTitle = computed(() => this.isEditMode() ? 'Edit Recipe' : 'Create New Recipe');
  protected readonly pageDescription = computed(() =>
    this.isEditMode()
      ? 'Review the saved recipe details and prepare your changes in the existing edit route.'
      : 'Build a new recipe with its image, ingredients, and nutrition totals.'
  );
  protected readonly saveButtonLabel = computed(() => {
    if (this.isSaving()) {
      return this.isEditMode() ? 'Updating Recipe...' : 'Saving Recipe...';
    }

    return this.isEditMode() ? 'Update Recipe' : 'Save Recipe';
  });
  private readonly saveFeedbackPending = signal(false);
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
    instructions: new FormArray<FormControl<string>>([]),
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
    badges: new FormControl<RecipeBadge[]>([], {
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
  private readonly editRecipeId = computed(() => {
    const id = Number(this.routeId());
    return Number.isInteger(id) && id > 0 ? id : null;
  });

  constructor() {
    effect(() => {
      const isEditMode = this.isEditMode();

      untracked(() => {
        this.applyImageValidators(isEditMode);
      });
    }, { allowSignalWrites: true });

    effect(() => {
      if (!this.saveFeedbackPending() || this.isSaving()) {
        return;
      }

      const message = this.errorMessage();
      if (!message) {
        return;
      }

      untracked(() => {
        this.saveFeedbackPending.set(false);
        this.openFeedbackDialog({
          eyebrow: 'Save failed',
          title: 'Recipe could not be saved',
          description: 'We were not able to finish saving your recipe.',
          message,
        });
      });
    }, { allowSignalWrites: true });
  }

  get nameControl(): FormControl<string> {
    return this.form.controls.name;
  }

  get imageControl(): FormControl<File | null> {
    return this.form.controls.image;
  }

  get instructionsControl(): FormArray<FormControl<string>> {
    return this.form.controls.instructions;
  }

  get instructionStepControls(): FormControl<string>[] {
    return this.instructionsControl.controls;
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

    this.route.paramMap.pipe(
      map(paramMap => paramMap.get('id')),
      switchMap(routeId => {
        this.editRecipeLoadError.set(null);

        if (routeId === null) {
          this.isEditRecipeLoading.set(false);
          this.isEditRecipeReady.set(true);
          this.resetCreateForm();
          return of({ kind: 'create' as const });
        }

        const id = Number(routeId);
        if (!Number.isInteger(id) || id <= 0) {
          this.isEditRecipeLoading.set(false);
          this.isEditRecipeReady.set(false);
          void this.router.navigate(['/admin-recipes/create'], { replaceUrl: true });
          return of({ kind: 'invalid' as const });
        }

        this.isEditRecipeReady.set(false);
        this.isEditRecipeLoading.set(true);

        return this.recipesFacade.getRecipesWithDetails(id).pipe(
          map(recipe => ({ kind: 'loaded' as const, recipe })),
          defaultIfEmpty({ kind: 'failed' as const }),
          finalize(() => this.isEditRecipeLoading.set(false))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(result => {
      if (result.kind === 'create' || result.kind === 'invalid') {
        return;
      }

      if (result.kind === 'failed') {
        this.isEditRecipeReady.set(false);
        this.editRecipeLoadError.set(
          this.errorMessage() ?? 'We could not load this recipe. Please try again.'
        );
        return;
      }

      this.populateFormForEdit(result.recipe);
      this.isEditRecipeReady.set(true);
    });
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

  // Exposes the selected recipe highlights for the summary card.
  get selectedBadges(): RecipeBadge[] {
    return this.form.controls.badges.value;
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

  // Adds one editable instruction step to the recipe draft.
  addInstructionStep(value = ''): void {
    this.instructionsControl.push(this.createInstructionStepControl(value));
    this.instructionsControl.markAsDirty();
    this.instructionsControl.markAsTouched();
  }

  // Removes one instruction step from the recipe draft.
  removeInstructionStep(index: number): void {
    this.instructionsControl.removeAt(index);
    this.instructionsControl.markAsDirty();
    this.instructionsControl.markAsTouched();
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

  // Toggles one recipe highlight tag on the recipe.
  toggleBadge(badge: RecipeBadge): void {
    const control = this.form.controls.badges;
    const current = control.value;
    control.setValue(
      current.includes(badge)
        ? current.filter(item => item !== badge)
        : [...current, badge]
    );
    control.markAsDirty();
    control.markAsTouched();
  }

  // Reports whether a recipe highlight is selected.
  isBadgeSelected(badge: RecipeBadge): boolean {
    return this.form.controls.badges.value.includes(badge);
  }

  // Formats a recipe highlight label for display.
  getBadgeLabel(badge: RecipeBadge): string {
    switch (badge) {
      case 'freezer-friendly':
        return 'Freezer-friendly';
      case 'budget-focused':
        return 'Budget-focused';
      case 'high-protein':
        return 'High-protein';
    }
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
    this.previewImageObjectUrl = URL.createObjectURL(selection.file);
    this.previewImageUrl = this.previewImageObjectUrl;
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

    this.saveFeedbackPending.set(true);
    const editRecipeId = this.editRecipeId();
    const saveRequest$ = editRecipeId === null
      ? this.recipesFacade.createRecipeWithDetails(recipeRequest)
      : this.recipesFacade.updateRecipeWithDetails(editRecipeId, recipeRequest);

    saveRequest$.pipe(
      tap(recipeSummary => {
        if (editRecipeId === null) {
          return;
        }

        this.applyUpdatedRecipeSummary(recipeSummary);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: recipeSummary => {
        this.saveFeedbackPending.set(false);
        if (editRecipeId === null) {
          void this.navigateToSuccessPage(recipeSummary);
          return;
        }

        this.openFeedbackDialog({
          eyebrow: 'Recipe updated',
          title: 'Recipe updated successfully',
          description: 'Your changes were saved to the current recipe.',
          message: `"${recipeSummary.name}" is now up to date.`,
          actionLabel: 'Continue editing',
        });
      },
    });
  }

  // Converts the page state into the recipe detail request shape used by the facade.
  private buildRecipeRequest(): RecipeDetailRequest | null {
    const value = this.form.getRawValue();
    const instructions = this.getNormalizedInstructionSteps();

    if (!value.image && !this.isEditMode()) {
      this.form.controls.image.setErrors({ required: true });
      this.form.controls.image.markAsTouched();
      return null;
    }

    const name = value.name.trim();

    if (!name) {
      this.form.controls.name.setErrors({ requiredTrimmed: true });
      this.form.controls.name.markAsTouched();
      return null;
    }

    if (instructions.length === 0) {
      this.instructionsControl.markAsTouched();
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
      badges: value.badges,
      dietIds: value.dietIds,
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
    this.form.controls.image.updateValueAndValidity({ emitEvent: false });
  }

  // Revokes the generated object URL to avoid leaking browser memory.
  private clearPreviewImage(): void {
    if (this.previewImageObjectUrl) {
      URL.revokeObjectURL(this.previewImageObjectUrl);
      this.previewImageObjectUrl = null;
    }

    this.previewImageUrl = null;
  }

  protected shouldShowControlError(control: AbstractControl): boolean {
    return control.invalid && (control.touched || this.submitAttempted());
  }

  protected hasInstructionsError(): boolean {
    return this.submitAttempted() && this.getNormalizedInstructionSteps().length === 0;
  }

  private applyImageValidators(isEditMode: boolean): void {
    const imageControl = this.form.controls.image;
    imageControl.setValidators(isEditMode ? [] : [Validators.required]);
    imageControl.updateValueAndValidity({ emitEvent: false });
  }

  private populateFormForEdit(recipe: RecipeDetailDto): void {
    this.submitAttempted.set(false);
    this.selectedImageName = recipe.imageUrl ? 'Current image on file' : '';
    this.setPreviewImage(recipe.imageUrl);
    this.replaceInstructionSteps(recipe.instructions);
    this.form.patchValue({
      name: recipe.name,
      image: null,
      servings: recipe.servings,
      prepTimeMinutes: recipe.prepTimeMinutes,
      difficulty: recipe.difficulty,
      badges: recipe.badges ?? [],
      dietIds: recipe.diets?.map(diet => diet.id) ?? [],
    }, { emitEvent: false });
    this.ingredients.set(
      recipe.ingredients.map(recipeIngredient => ({
        ingredientId: recipeIngredient.ingredientId,
        quantity: recipeIngredient.quantity,
        unit: recipeIngredient.unit,
        ingredient: recipeIngredient.ingredient,
      }))
    );
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private resetCreateForm(): void {
    this.submitAttempted.set(false);
    this.selectedImageName = '';
    this.editRecipeLoadError.set(null);
    this.clearPreviewImage();
    this.replaceInstructionSteps([]);
    this.form.reset({
      name: '',
      image: null,
      servings: 1,
      prepTimeMinutes: 15,
      difficulty: 'Medium',
      badges: [],
      dietIds: [],
    }, { emitEvent: false });
    this.ingredients.set([]);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private setPreviewImage(imageUrl: string | null): void {
    this.clearPreviewImage();
    this.previewImageUrl = imageUrl;
  }

  private applyUpdatedRecipeSummary(recipeSummary: RecipeSummary): void {
    this.selectedImageName = recipeSummary.imageUrl ? 'Current image on file' : '';
    this.form.controls.image.setValue(null);
    this.setPreviewImage(recipeSummary.imageUrl);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private openFeedbackDialog(data: RecipeFeedbackDialogData): void {
    this.dialog.open(RecipeFeedbackDialogComponent, {
      data,
      role: 'alertdialog',
      ariaLabel: data.title,
      maxWidth: '32rem',
      width: 'calc(100vw - 2rem)',
    });
  }

  private navigateToSuccessPage(recipeSummary: RecipeSummary): Promise<boolean> {
    return this.router.navigate(
      ['/admin-recipes', 'create', 'success', recipeSummary.id],
      {
        replaceUrl: true,
        state: {
          recipeSummary,
        },
      }
    );
  }

  private createInstructionStepControl(value = ''): FormControl<string> {
    return new FormControl(value, {
      nonNullable: true,
    });
  }

  private replaceInstructionSteps(steps: string[]): void {
    this.instructionsControl.clear();

    for (const step of steps) {
      this.instructionsControl.push(this.createInstructionStepControl(step));
    }
  }

  private getNormalizedInstructionSteps(): string[] {
    return this.instructionsControl.getRawValue()
      .map(step => step.trim())
      .filter(step => step.length > 0);
  }
}

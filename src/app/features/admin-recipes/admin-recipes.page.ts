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
import { IngredientDetailsFacade } from '@app/core/shared/data-access/ingredients/admin/ingredient-details.facade';
import { IngredientDialogResult } from '@app/core/shared/data-access/ingredients/ingredient.model';
import {
  RecipeBadge,
  RecipeDetailDto,
  RecipeDetailRequest,
  RecipeDifficulty,
  RecipeFeaturedOrder,
  RecipeInstructionStep,
  RecipeSummary,
} from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { AdminRecipeFacade } from '@app/core/shared/data-access/recipes/admin/admin-recipe.facade';
import { readAvifFileSelection } from '@app/core/shared/utils/avif-file-selection/avif-file-selection';

import {
  EMPTY_RECIPE_CALCULATION,
  RecipeCalculation,
  RecipeCreationForm,
  RecipeCreationIngredient,
  RecipeInstructionStepDraft,
  RecipeInstructionStepForm,
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

const structuredInstructionStepValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const value = control.value as RecipeInstructionStepDraft;
  const title = value.title?.trim() ?? '';
  const instruction = value.instruction?.trim() ?? '';

  if (!title && !instruction) {
    return null;
  }

  const errors: ValidationErrors = {};
  if (!title) errors['titleRequired'] = true;
  if (!instruction) errors['instructionRequired'] = true;
  return Object.keys(errors).length > 0 ? errors : null;
};

const atLeastOneCompleteInstructionValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const values = control.value as RecipeInstructionStepDraft[];
  const hasCompleteStep = values.some(
    value => Boolean(value.title?.trim()) && Boolean(value.instruction?.trim())
  );
  return hasCompleteStep ? null : { required: true };
};

const validRecipeTimesValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const value = control.value as {
    prepTimeMinutes?: number;
    cookTimeMinutes?: number;
    totalTimeMinutes?: number;
  };
  const { prepTimeMinutes, cookTimeMinutes, totalTimeMinutes } = value;

  if (
    typeof prepTimeMinutes !== 'number'
    || typeof cookTimeMinutes !== 'number'
    || typeof totalTimeMinutes !== 'number'
  ) {
    return null;
  }

  return totalTimeMinutes >= prepTimeMinutes && totalTimeMinutes >= cookTimeMinutes
    ? null
    : { invalidTotalTime: true };
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
    { value: 'High Protein', label: 'High Protein' },
    { value: 'Low Calorie', label: 'Low Calorie' },
    { value: 'Low Carb', label: 'Low Carb' },
    { value: 'High Fiber', label: 'High Fiber' },
    { value: 'Quick Meal', label: 'Quick Meal' },
    { value: 'Meal Prep', label: 'Meal Prep' },
    { value: 'Freezer Friendly', label: 'Freezer Friendly' },
    { value: 'Budget Friendly', label: 'Budget Friendly' },
    { value: 'Few Ingredients', label: 'Few Ingredients' },
  ];

  //########## Dependencies ############
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dietsFacade = inject(DietsFacade);
  private readonly ingredientsFacade = inject(IngredientsFacade);
  private readonly ingredientDetailsFacade = inject(IngredientDetailsFacade);
  private readonly recipesFacade = inject(RecipesFacade);
  private readonly adminRecipeFacade = inject(AdminRecipeFacade);

  //########## Page State ############
  protected previewImageUrl: string | null = null;
  private previewImageObjectUrl: string | null = null;
  protected selectedImageName = '';
  protected readonly ingredients = signal<RecipeCreationIngredient[]>([]);
  protected readonly duplicateIngredientError = signal<string | null>(null);
  private readonly recipeCalculation = signal<RecipeCalculation>(EMPTY_RECIPE_CALCULATION);
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
  protected readonly featuredIngredientCount = computed(
    () => this.ingredients().filter(ingredient => ingredient.featuredOrder !== null).length
  );
  private readonly hasValidFeaturedIngredientCount = computed(() => {
    const count = this.featuredIngredientCount();
    return count >= 1 && count <= 3;
  });
  protected readonly hasFeaturedIngredientsError = computed(
    () => this.submitAttempted()
      && this.ingredients().length > 0
      && !this.hasValidFeaturedIngredientCount()
  );
  protected readonly errorMessage = toSignal(this.adminRecipeFacade.error$, { initialValue: null });
  protected readonly isSaving = toSignal(this.adminRecipeFacade.isLoading$, { initialValue: false });

  //########## Page Form ############
  readonly form: RecipeCreationForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [requiredTrimmedValidator],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [requiredTrimmedValidator, Validators.maxLength(500)],
    }),
    image: new FormControl<File | null>(null, {
      validators: [Validators.required],
    }),
    instructions: new FormArray<RecipeInstructionStepForm>([], {
      validators: [atLeastOneCompleteInstructionValidator],
    }),
    servings: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    prepTimeMinutes: new FormControl(15, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    cookTimeMinutes: new FormControl(15, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    totalTimeMinutes: new FormControl(30, {
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
  }, { validators: [validRecipeTimesValidator] });

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
    this.form.controls.servings.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateRecipePreview());

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

  get descriptionControl(): FormControl<string> {
    return this.form.controls.description;
  }

  get instructionsControl(): FormArray<RecipeInstructionStepForm> {
    return this.form.controls.instructions;
  }

  get instructionStepControls(): RecipeInstructionStepForm[] {
    return this.instructionsControl.controls;
  }

  get servingsControl(): FormControl<number> {
    return this.form.controls.servings;
  }

  get prepTimeMinutesControl(): FormControl<number> {
    return this.form.controls.prepTimeMinutes;
  }

  get cookTimeMinutesControl(): FormControl<number> {
    return this.form.controls.cookTimeMinutes;
  }

  get totalTimeMinutesControl(): FormControl<number> {
    return this.form.controls.totalTimeMinutes;
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

  // Exposes the current preview or saved calorie total.
  get totalCalories(): number {
    return Math.round(this.recipeCalculation().caloriesTotal);
  }

  // Exposes the current preview or saved protein total.
  get totalProtein(): number {
    return Math.round(this.recipeCalculation().proteinTotal);
  }

  get caloriesPerServing(): number {
    return Math.round(this.recipeCalculation().caloriesPerServing);
  }

  get proteinPerServing(): number {
    return Math.round(this.recipeCalculation().proteinPerServing);
  }

  // Exposes the current preview or saved carbohydrate total.
  get totalCarbs(): number {
    return Math.round(this.recipeCalculation().carbsTotal);
  }

  // Exposes the current preview or saved cost per serving.
  get estimatedCostPerServing(): number | null {
    return this.recipeCalculation().estimatedCostPerServing;
  }

  // Opens the ingredient dialog and loads full DTO details for the selected id.
  openIngredientDialog(): void {
    this.duplicateIngredientError.set(null);
    const dialogRef = this.dialog.open(IngredientDialogComponent);

    dialogRef.afterClosed().pipe(
      filter((result): result is IngredientDialogResult => result != null),
      filter(result => {
        if (!this.isIngredientSelected(result.ingredientId)) {
          return true;
        }

        this.duplicateIngredientError.set(
          'This ingredient is already linked to the recipe.'
        );
        return false;
      }),
      switchMap(result =>
        this.ingredientDetailsFacade.get(result.ingredientId).pipe(
          map(ingredient => ({
            ...result,
            ingredient,
            featuredOrder: null,
          }))
        )
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(recipeIngredient => {
      if (this.isIngredientSelected(recipeIngredient.ingredientId)) {
        this.duplicateIngredientError.set(
          'This ingredient is already linked to the recipe.'
        );
        return;
      }

      this.duplicateIngredientError.set(null);
      this.ingredients.update(ingredients => [...ingredients, recipeIngredient]);
      this.updateRecipePreview();
    });
  }

  // Removes one selected ingredient from the recipe draft.
  removeIngredient(index: number): void {
    this.duplicateIngredientError.set(null);
    this.ingredients.update(ingredients => {
      const removedOrder = ingredients[index]?.featuredOrder ?? null;

      return ingredients
        .filter((_, currentIndex) => currentIndex !== index)
        .map(ingredient => ({
          ...ingredient,
          featuredOrder:
            removedOrder !== null
            && ingredient.featuredOrder !== null
            && ingredient.featuredOrder > removedOrder
              ? (ingredient.featuredOrder - 1) as RecipeFeaturedOrder
              : ingredient.featuredOrder,
        }));
    });
    this.updateRecipePreview();
  }

  toggleFeaturedIngredient(index: number): void {
    this.ingredients.update(ingredients => {
      const selected = ingredients[index];
      if (!selected) return ingredients;

      if (selected.featuredOrder === null) {
        const nextOrder = this.featuredIngredientCount() + 1;
        if (nextOrder > 3) return ingredients;

        return ingredients.map((ingredient, currentIndex) =>
          currentIndex === index
            ? { ...ingredient, featuredOrder: nextOrder as RecipeFeaturedOrder }
            : ingredient
        );
      }

      const removedOrder = selected.featuredOrder;
      return ingredients.map((ingredient, currentIndex) => {
        if (currentIndex === index) {
          return { ...ingredient, featuredOrder: null };
        }

        return ingredient.featuredOrder !== null && ingredient.featuredOrder > removedOrder
          ? {
              ...ingredient,
              featuredOrder: (ingredient.featuredOrder - 1) as RecipeFeaturedOrder,
            }
          : ingredient;
      });
    });
  }

  canFeatureIngredient(ingredient: RecipeCreationIngredient): boolean {
    return ingredient.featuredOrder !== null || this.featuredIngredientCount() < 3;
  }

  // Adds one editable instruction step to the recipe draft.
  addInstructionStep(value: RecipeInstructionStepDraft = {}): void {
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

  private isIngredientSelected(ingredientId: number): boolean {
    return this.ingredients().some(ingredient => ingredient.ingredientId === ingredientId);
  }

  // Moves one instruction earlier while preserving the existing control instance.
  moveInstructionStepUp(index: number): void {
    this.moveInstructionStep(index, index - 1);
  }

  // Moves one instruction later while preserving the existing control instance.
  moveInstructionStepDown(index: number): void {
    this.moveInstructionStep(index, index + 1);
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
    return badge;
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

    if (
      this.form.invalid
      || this.ingredients().length === 0
      || !this.hasValidFeaturedIngredientCount()
    ) {
      return;
    }

    const recipeRequest = this.buildRecipeRequest();
    if (!recipeRequest) {
      return;
    }

    this.saveFeedbackPending.set(true);
    const editRecipeId = this.editRecipeId();
    const saveRequest$ = editRecipeId === null
      ? this.adminRecipeFacade.createRecipeWithDetails(recipeRequest)
      : this.adminRecipeFacade.updateRecipeWithDetails(editRecipeId, recipeRequest);

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

    if (instructions.length === 0 || this.instructionsControl.invalid) {
      this.instructionsControl.markAllAsTouched();
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

    return {
      name,
      description: value.description.trim(),
      image: value.image,
      instructions,
      prepTimeMinutes: value.prepTimeMinutes,
      cookTimeMinutes: value.cookTimeMinutes,
      totalTimeMinutes: value.totalTimeMinutes,
      servings: value.servings,
      difficulty: value.difficulty,
      badges: value.badges,
      dietIds: value.dietIds,
      ingredients: this.ingredients().map(ingredient => ({
        ingredientId: ingredient.ingredientId,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        featuredOrder: ingredient.featuredOrder,
      })),
    };
  }

  // Calculates the complete live preview once when its source data changes.
  private calculateRecipePreview(): RecipeCalculation {
    const ingredients = this.ingredients();
    const servings = this.servingsValue;
    let caloriesTotal = 0;
    let proteinTotal = 0;
    let carbsTotal = 0;
    let totalCost = 0;
    let hasCompletePricing = servings > 0 && ingredients.length > 0;

    for (const recipeIngredient of ingredients) {
      const factor = this.getIngredientQuantityFactor(recipeIngredient);
      const detail = recipeIngredient.ingredient;
      caloriesTotal += detail.caloriesKcal * factor;
      proteinTotal += (detail.proteinG ?? 0) * factor;
      carbsTotal += (detail.carbsG ?? 0) * factor;

      if (detail.price === null) {
        hasCompletePricing = false;
      } else {
        totalCost += detail.price * factor;
      }
    }

    const roundedCaloriesTotal = this.roundTo(caloriesTotal, 2);
    const roundedProteinTotal = this.roundTo(proteinTotal, 2);

    return {
      caloriesTotal: roundedCaloriesTotal,
      proteinTotal: roundedProteinTotal,
      carbsTotal: this.roundTo(carbsTotal, 2),
      caloriesPerServing: servings > 0
        ? this.roundTo(roundedCaloriesTotal / servings, 2)
        : 0,
      proteinPerServing: servings > 0
        ? this.roundTo(roundedProteinTotal / servings, 2)
        : 0,
      estimatedCostPerServing: hasCompletePricing
        ? this.roundTo(totalCost / servings, 2)
        : null,
    };
  }

  private updateRecipePreview(): void {
    this.recipeCalculation.set(this.calculateRecipePreview());
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

  protected shouldShowTotalTimeError(): boolean {
    return this.shouldShowControlError(this.totalTimeMinutesControl)
      || (
        this.form.hasError('invalidTotalTime')
        && (this.totalTimeMinutesControl.touched || this.submitAttempted())
      );
  }

  protected totalTimeErrorMessage(): string {
    return this.totalTimeMinutesControl.hasError('min')
      ? 'Total time must be at least 1 minute.'
      : 'Total time must be at least the prep time and cook time.';
  }

  protected hasInstructionsError(): boolean {
    return this.submitAttempted() && this.instructionsControl.invalid;
  }

  protected instructionsErrorMessage(): string {
    return this.instructionsControl.hasError('required')
      ? 'Add at least one complete instruction step before saving.'
      : 'Complete both fields for every partially filled instruction step.';
  }

  protected shouldShowInstructionFieldError(
    step: RecipeInstructionStepForm,
    field: 'title' | 'instruction'
  ): boolean {
    if (!this.submitAttempted() && !step.controls[field].touched) {
      return false;
    }

    const groupError = field === 'title' ? 'titleRequired' : 'instructionRequired';
    return step.hasError(groupError) || this.instructionsControl.hasError('required');
  }

  private applyImageValidators(isEditMode: boolean): void {
    const imageControl = this.form.controls.image;
    imageControl.setValidators(isEditMode ? [] : [Validators.required]);
    imageControl.updateValueAndValidity({ emitEvent: false });
  }

  private populateFormForEdit(recipe: RecipeDetailDto): void {
    this.submitAttempted.set(false);
    this.duplicateIngredientError.set(null);
    this.selectedImageName = recipe.previewImageUrl ? 'Current image on file' : '';
    this.setPreviewImage(recipe.previewImageUrl);
    this.replaceInstructionSteps(recipe.instructions);
    this.form.patchValue({
      name: recipe.name,
      description: recipe.description,
      image: null,
      servings: recipe.servings,
      prepTimeMinutes: recipe.prepTimeMinutes,
      cookTimeMinutes: recipe.cookTimeMinutes,
      totalTimeMinutes: recipe.totalTimeMinutes,
      difficulty: recipe.difficulty,
      badges: recipe.badges ?? [],
      dietIds: recipe.diets?.map(diet => diet.id) ?? [],
    }, { emitEvent: false });
    this.ingredients.set(
      recipe.ingredients.map(recipeIngredient => ({
        ingredientId: recipeIngredient.ingredientId,
        quantity: recipeIngredient.quantity,
        unit: recipeIngredient.unit,
        featuredOrder: recipeIngredient.featuredOrder,
        ingredient: recipeIngredient.ingredient,
      }))
    );
    this.applySavedCalculation(recipe);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private resetCreateForm(): void {
    this.submitAttempted.set(false);
    this.duplicateIngredientError.set(null);
    this.selectedImageName = '';
    this.editRecipeLoadError.set(null);
    this.clearPreviewImage();
    this.replaceInstructionSteps([{}]);
    this.form.reset({
      name: '',
      description: '',
      image: null,
      servings: 1,
      prepTimeMinutes: 15,
      cookTimeMinutes: 15,
      totalTimeMinutes: 30,
      difficulty: 'Medium',
      badges: [],
      dietIds: [],
    }, { emitEvent: false });
    this.ingredients.set([]);
    this.recipeCalculation.set(EMPTY_RECIPE_CALCULATION);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private setPreviewImage(previewImageUrl: string | null): void {
    this.clearPreviewImage();
    this.previewImageUrl = previewImageUrl;
  }

  private applyUpdatedRecipeSummary(recipeSummary: RecipeSummary): void {
    this.selectedImageName = recipeSummary.previewImageUrl ? 'Current image on file' : '';
    this.form.controls.image.setValue(null);
    this.setPreviewImage(recipeSummary.previewImageUrl);
    this.applySavedCalculation(recipeSummary);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private applySavedCalculation(recipe: RecipeCalculation): void {
    this.recipeCalculation.set({
      caloriesTotal: recipe.caloriesTotal,
      proteinTotal: recipe.proteinTotal,
      carbsTotal: recipe.carbsTotal,
      caloriesPerServing: recipe.caloriesPerServing,
      proteinPerServing: recipe.proteinPerServing,
      estimatedCostPerServing: recipe.estimatedCostPerServing,
    });
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

  private createInstructionStepControl(
    value: RecipeInstructionStepDraft = {}
  ): RecipeInstructionStepForm {
    return new FormGroup(
      {
        title: new FormControl(value.title ?? '', { nonNullable: true }),
        instruction: new FormControl(value.instruction ?? '', { nonNullable: true }),
      },
      { validators: [structuredInstructionStepValidator] }
    );
  }

  private moveInstructionStep(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0
      || fromIndex >= this.instructionsControl.length
      || toIndex < 0
      || toIndex >= this.instructionsControl.length
      || fromIndex === toIndex
    ) {
      return;
    }

    const control = this.instructionsControl.at(fromIndex);
    this.instructionsControl.removeAt(fromIndex);
    this.instructionsControl.insert(toIndex, control);
    this.instructionsControl.markAsDirty();
    this.instructionsControl.markAsTouched();
  }

  private replaceInstructionSteps(steps: RecipeInstructionStepDraft[]): void {
    this.instructionsControl.clear();

    for (const step of steps) {
      this.instructionsControl.push(this.createInstructionStepControl(step));
    }
  }

  private getNormalizedInstructionSteps(): RecipeInstructionStep[] {
    return this.instructionsControl.getRawValue()
      .map(step => ({
        title: step.title.trim(),
        instruction: step.instruction.trim(),
      }))
      .filter(step => step.title.length > 0 || step.instruction.length > 0);
  }
}

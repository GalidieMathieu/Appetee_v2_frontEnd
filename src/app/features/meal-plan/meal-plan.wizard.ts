import { Injectable, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { finalize, map, Observable, of } from 'rxjs';

import { RecipeSummary } from '@app/core/shared/data-access/recipes/recipe.model';

import {
  MealPlanCalculation,
  MealPlanDetail,
  MealPlanDraftInput,
  MealPlanPreviewRequest,
  MealPlanRecipeSelection,
  MealPlanSaveRequest,
  MealPlanSelectionSnapshot,
  MealPlanSuggestionSort,
  MealPlanTarget,
} from './meal-plan.model';
import { MealPlanFacade } from './meal-plan.facade';

const defaultTargetValue: MealPlanTarget = {
  name: '',
  durationDays: 7,
  mealsPerDay: 3,
  caloriesPerDay: 2200,
  proteinPerDay: 160,
  dietIds: [],
  ingredientRestrictionIds: [],
  maxPrepTimeMinutes: 40,
  difficulty: null,
  freezerFriendlyOnly: false,
};

const defaultDiscoveryValue: {
  ingredientQuery: string;
  sortBy: MealPlanSuggestionSort;
} = {
  ingredientQuery: '',
  sortBy: 'highest-protein',
};

export type MealPlanTargetForm = FormGroup<{
  name: FormControl<string>;
  durationDays: FormControl<number>;
  mealsPerDay: FormControl<number>;
  caloriesPerDay: FormControl<number>;
  proteinPerDay: FormControl<number>;
  dietIds: FormControl<number[]>;
  ingredientRestrictionIds: FormControl<number[]>;
  maxPrepTimeMinutes: FormControl<number | null>;
  difficulty: FormControl<MealPlanTarget['difficulty']>;
  freezerFriendlyOnly: FormControl<boolean>;
}>;

export type MealPlanDiscoveryForm = FormGroup<{
  ingredientQuery: FormControl<string>;
  sortBy: FormControl<MealPlanSuggestionSort>;
}>;

export type MealPlanRecipeSelectionForm = FormGroup<{
  recipeId: FormControl<number>;
  portions: FormControl<number>;
  frequencyPerWeek: FormControl<number>;
}>;

@Injectable()
export class MealPlanWizard {
  private suspendDirtyTracking = false;
  private readonly lastCalculatedSelectionSnapshotState = signal<MealPlanSelectionSnapshot[]>([]);

  readonly mode = signal<'create' | 'edit'>('create');
  readonly editingMealPlanId = signal<number | null>(null);
  readonly replacementRecipeId = signal<number | null>(null);
  readonly calculation = signal<MealPlanCalculation | null>(null);
  readonly hasPendingRecalculation = signal(false);
  readonly isRecalculating = signal(false);

  readonly target: MealPlanTargetForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    durationDays: new FormControl(7, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    mealsPerDay: new FormControl(3, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    caloriesPerDay: new FormControl(2200, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1200)],
    }),
    proteinPerDay: new FormControl(160, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(60)],
    }),
    dietIds: new FormControl<number[]>([], { nonNullable: true }),
    ingredientRestrictionIds: new FormControl<number[]>([], { nonNullable: true }),
    maxPrepTimeMinutes: new FormControl<number | null>(40, {
      validators: [Validators.min(10)],
    }),
    difficulty: new FormControl<MealPlanTarget['difficulty']>(null),
    freezerFriendlyOnly: new FormControl(false, { nonNullable: true }),
  });

  readonly discovery: MealPlanDiscoveryForm = new FormGroup({
    ingredientQuery: new FormControl('', { nonNullable: true }),
    sortBy: new FormControl<MealPlanSuggestionSort>('highest-protein', {
      nonNullable: true,
    }),
  });

  readonly selectedMeals = new FormArray<MealPlanRecipeSelectionForm>([]);

  constructor() {
    this.target.valueChanges.subscribe(() => this.markPlanDirty());
    this.selectedMeals.valueChanges.subscribe(() => this.markPlanDirty());
  }

  reset(): void {
    this.suspendDirtyTracking = true;
    this.mode.set('create');
    this.editingMealPlanId.set(null);
    this.replacementRecipeId.set(null);
    this.calculation.set(null);
    this.hasPendingRecalculation.set(false);
    this.isRecalculating.set(false);
    this.lastCalculatedSelectionSnapshotState.set([]);
    this.target.reset(defaultTargetValue);
    this.discovery.reset(defaultDiscoveryValue);
    this.selectedMeals.clear();
    this.suspendDirtyTracking = false;
  }

  hydrate(detail: MealPlanDetail): void {
    this.suspendDirtyTracking = true;

    this.mode.set('edit');
    this.editingMealPlanId.set(detail.id);
    this.replacementRecipeId.set(null);
    this.target.reset({ ...detail.target });
    this.discovery.reset(defaultDiscoveryValue);
    this.selectedMeals.clear();

    for (const meal of detail.selectedMeals) {
      this.selectedMeals.push(
        this.createSelectedMealGroup({
          recipeId: meal.recipe.id,
          portions: meal.portions,
          frequencyPerWeek: meal.frequencyPerWeek,
        })
      );
    }

    this.calculation.set({
      selectedMeals: detail.selectedMeals,
      preview: detail.preview,
      shoppingList: detail.shoppingList,
      badges: detail.badges,
    });
    this.lastCalculatedSelectionSnapshotState.set(
      detail.selectedMeals.map(meal => ({
        recipeId: meal.recipe.id,
        portions: meal.portions,
        frequencyPerWeek: meal.frequencyPerWeek,
      }))
    );
    this.hasPendingRecalculation.set(false);
    this.isRecalculating.set(false);
    this.suspendDirtyTracking = false;
  }

  buildDraft(): MealPlanDraftInput {
    return {
      id: this.editingMealPlanId() ?? undefined,
      target: this.target.getRawValue(),
      selectedMeals: this.selectedMeals.getRawValue(),
    };
  }

  buildPreviewRequest(): MealPlanPreviewRequest {
    return {
      target: this.target.getRawValue(),
      selectedMeals: this.selectedMeals.getRawValue(),
      previousSelections: this.lastCalculatedSelectionSnapshotState(),
    };
  }

  buildSaveRequest(): MealPlanSaveRequest {
    return {
      id: this.editingMealPlanId() ?? undefined,
      ...this.buildPreviewRequest(),
    };
  }

  lastCalculatedSelectionSnapshot(): MealPlanSelectionSnapshot[] {
    return this.lastCalculatedSelectionSnapshotState();
  }

  hasSelectedMeals(): boolean {
    return this.selectedMeals.length > 0;
  }

  addRecipe(recipe: RecipeSummary): void {
    const replacementId = this.replacementRecipeId();
    if (replacementId !== null) {
      this.replaceSelectedMeal(replacementId, recipe);
      return;
    }

    const alreadySelected = this.selectedMeals.controls.some(
      meal => meal.controls.recipeId.value === recipe.id
    );
    if (alreadySelected) {
      return;
    }

    this.selectedMeals.push(
      this.createSelectedMealGroup({
        recipeId: recipe.id,
        portions: recipe.servings,
        frequencyPerWeek: 1,
      })
    );
  }

  removeSelectedMeal(recipeId: number): void {
    const index = this.selectedMeals.controls.findIndex(
      meal => meal.controls.recipeId.value === recipeId
    );

    if (index < 0) {
      return;
    }

    this.selectedMeals.removeAt(index);
    if (this.replacementRecipeId() === recipeId) {
      this.replacementRecipeId.set(null);
    }
  }

  beginReplacement(recipeId: number): void {
    this.replacementRecipeId.set(recipeId);
  }

  cancelReplacement(): void {
    this.replacementRecipeId.set(null);
  }

  recalculate(mealPlanFacade: MealPlanFacade): Observable<MealPlanCalculation | null> {
    const selections = this.selectedMeals.getRawValue();
    if (selections.length === 0) {
      this.calculation.set(null);
      this.hasPendingRecalculation.set(false);
      this.lastCalculatedSelectionSnapshotState.set([]);
      return of(null);
    }

    this.isRecalculating.set(true);

    return mealPlanFacade.previewMealPlan(this.buildPreviewRequest()).pipe(
      map(calculation => {
        this.calculation.set(calculation);
        this.hasPendingRecalculation.set(false);
        this.lastCalculatedSelectionSnapshotState.set(
          selections.map(selection => ({
            recipeId: selection.recipeId,
            portions: selection.portions,
            frequencyPerWeek: selection.frequencyPerWeek,
          }))
        );
        this.replacementRecipeId.set(null);

        return calculation;
      }),
      finalize(() => this.isRecalculating.set(false))
    );
  }

  private createSelectedMealGroup(
    selection?: Partial<MealPlanRecipeSelection>
  ): MealPlanRecipeSelectionForm {
    return new FormGroup({
      recipeId: new FormControl(selection?.recipeId ?? 0, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1)],
      }),
      portions: new FormControl(selection?.portions ?? 4, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1)],
      }),
      frequencyPerWeek: new FormControl(selection?.frequencyPerWeek ?? 1, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1)],
      }),
    });
  }

  private replaceSelectedMeal(targetRecipeId: number, recipe: RecipeSummary): void {
    const index = this.selectedMeals.controls.findIndex(
      meal => meal.controls.recipeId.value === targetRecipeId
    );

    if (index < 0) {
      this.replacementRecipeId.set(null);
      return;
    }

    const duplicateSelection = this.selectedMeals.controls.some(
      meal =>
        meal.controls.recipeId.value === recipe.id &&
        meal.controls.recipeId.value !== targetRecipeId
    );

    if (duplicateSelection) {
      this.replacementRecipeId.set(null);
      return;
    }

    this.selectedMeals.at(index).patchValue({ recipeId: recipe.id });
    this.replacementRecipeId.set(null);
  }

  private markPlanDirty(): void {
    if (this.suspendDirtyTracking) {
      return;
    }

    if (this.selectedMeals.length === 0) {
      this.calculation.set(null);
      this.hasPendingRecalculation.set(false);
      this.lastCalculatedSelectionSnapshotState.set([]);
      return;
    }

    this.hasPendingRecalculation.set(true);
  }
}

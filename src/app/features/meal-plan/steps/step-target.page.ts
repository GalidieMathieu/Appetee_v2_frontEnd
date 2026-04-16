import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { startWith } from 'rxjs';

import { Diet } from '@app/core/shared/data-access/diets/diet.model';
import { DietsFacade } from '@app/core/shared/data-access/diets/diets.facade';
import { IngredientsFacade } from '@app/core/shared/data-access/ingredients/ingredient.facade';
import { Ingredient } from '@app/core/shared/data-access/ingredients/ingredient.model';
import { RecipeDifficulty } from '@app/core/shared/data-access/recipes/recipe.model';

import { MealPlanWizard } from '../meal-plan.wizard';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './step-target.page.html',
  styleUrl: './step-target.page.scss',
})
export class StepTargetPageComponent implements OnInit {
  readonly wizard = inject(MealPlanWizard);
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly difficultyOptions: RecipeDifficulty[] = ['Easy', 'Medium', 'Hard'];

  private readonly dietsFacade = inject(DietsFacade);
  private readonly ingredientsFacade = inject(IngredientsFacade);

  readonly diets = toSignal(this.dietsFacade.diets$, {
    initialValue: [] as Diet[],
  });
  readonly ingredients = toSignal(this.ingredientsFacade.ingredients$, {
    initialValue: [] as Ingredient[],
  });
  readonly search = toSignal(
    this.searchControl.valueChanges.pipe(startWith(this.searchControl.value)),
    { initialValue: this.searchControl.value }
  );
  readonly selectedIngredientIds = toSignal(
    this.wizard.target.controls.ingredientRestrictionIds.valueChanges.pipe(
      startWith(this.wizard.target.controls.ingredientRestrictionIds.value)
    ),
    { initialValue: this.wizard.target.controls.ingredientRestrictionIds.value }
  );

  readonly filteredIngredients = computed(() => {
    const term = this.search().trim().toLowerCase();
    const ingredients = this.ingredients();

    if (!term) {
      return ingredients.slice(0, 12);
    }

    return ingredients
      .filter(ingredient => ingredient.name.toLowerCase().includes(term))
      .slice(0, 12);
  });

  readonly selectedIngredients = computed(() => {
    const ids = new Set(this.selectedIngredientIds());
    return this.ingredients().filter(ingredient => ids.has(ingredient.id));
  });

  ngOnInit(): void {
    this.dietsFacade.loadIfNeeded();
    this.ingredientsFacade.loadIfNeeded();
  }

  toggleDiet(id: number): void {
    const control = this.wizard.target.controls.dietIds;
    const current = control.value;
    control.setValue(current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
    control.markAsDirty();
    control.markAsTouched();
  }

  toggleIngredient(id: number): void {
    const control = this.wizard.target.controls.ingredientRestrictionIds;
    const current = control.value;
    control.setValue(current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
    control.markAsDirty();
    control.markAsTouched();
  }

  isDietSelected(id: number): boolean {
    return this.wizard.target.controls.dietIds.value.includes(id);
  }

  isIngredientSelected(id: number): boolean {
    return this.wizard.target.controls.ingredientRestrictionIds.value.includes(id);
  }

  setDifficulty(difficulty: RecipeDifficulty): void {
    const control = this.wizard.target.controls.difficulty;
    control.setValue(control.value === difficulty ? null : difficulty);
    control.markAsDirty();
    control.markAsTouched();
  }

  isDifficultySelected(difficulty: RecipeDifficulty): boolean {
    return this.wizard.target.controls.difficulty.value === difficulty;
  }
}

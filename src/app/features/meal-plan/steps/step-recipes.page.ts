import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { startWith } from 'rxjs';

import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { RecipeSummary } from '@app/core/shared/data-access/recipes/recipe.model';

import { MealPlanSuggestionSort } from '../meal-plan.model';
import { matchesMealPlanTarget, sortRecipesForDiscovery } from '../meal-plan.utils';
import { MealPlanWizard } from '../meal-plan.wizard';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './step-recipes.page.html',
  styleUrl: './step-recipes.page.scss',
})
export class StepRecipesPageComponent implements OnInit {
  readonly wizard = inject(MealPlanWizard);
  readonly pageOffset = signal(0);
  readonly sortOptions: Array<{ value: MealPlanSuggestionSort; label: string }> = [
    { value: 'highest-protein', label: 'Highest Protein' },
    { value: 'cheapest', label: 'Cheapest' },
    { value: 'freezer-friendly', label: 'Freezer-Friendly' },
    { value: 'easiest', label: 'Easiest' },
    { value: 'fastest', label: 'Fastest' },
  ];

  private readonly recipesFacade = inject(RecipesFacade);

  readonly recipes = toSignal(this.recipesFacade.recipes$, {
    initialValue: [] as RecipeSummary[],
  });
  readonly selectedMealsValue = toSignal(
    this.wizard.selectedMeals.valueChanges.pipe(startWith(this.wizard.selectedMeals.getRawValue())),
    { initialValue: this.wizard.selectedMeals.getRawValue() }
  );

  readonly selectedMealCards = computed(() =>
    this.selectedMealsValue()
      .map(selection => ({
        recipe: this.recipes().find(recipe => recipe.id === selection.recipeId) ?? null,
        portions: selection.portions,
        frequencyPerWeek: selection.frequencyPerWeek,
      }))
      .filter(
        (meal): meal is { recipe: RecipeSummary; portions: number; frequencyPerWeek: number } =>
          meal.recipe !== null
      )
  );

  readonly replacementMeal = computed(() => {
    const replacementId = this.wizard.replacementRecipeId();
    return this.selectedMealCards().find(meal => meal.recipe.id === replacementId) ?? null;
  });

  readonly filteredRecipes = computed(() => {
    const target = this.wizard.target.getRawValue();
    const ingredientQuery =
      this.wizard.discovery.controls.ingredientQuery.value.trim().toLowerCase();
    const sortBy = this.wizard.discovery.controls.sortBy.value;
    const selectedIds = new Set(
      this.selectedMealsValue().map(selection => selection.recipeId)
    );
    const replacementId = this.wizard.replacementRecipeId();

    const recipes = this.recipes().filter(recipe => {
      if (!matchesMealPlanTarget(recipe, target)) {
        return false;
      }

      const matchesQuery =
        ingredientQuery.length === 0 ||
        recipe.name.toLowerCase().includes(ingredientQuery) ||
        recipe.ingredients.some(ingredient =>
          ingredient.name.toLowerCase().includes(ingredientQuery)
        );
      if (!matchesQuery) {
        return false;
      }

      if (replacementId !== null) {
        return recipe.id !== replacementId && !selectedIds.has(recipe.id);
      }

      return !selectedIds.has(recipe.id);
    });

    return sortRecipesForDiscovery(recipes, sortBy);
  });

  readonly visibleSuggestions = computed(() => {
    const suggestions = this.filteredRecipes();
    if (suggestions.length <= 5) {
      return suggestions;
    }

    const start = this.pageOffset() % suggestions.length;
    return Array.from({ length: 5 }, (_, index) => suggestions[(start + index) % suggestions.length]);
  });

  ngOnInit(): void {
    this.recipesFacade.loadIfNeeded();
    this.wizard.discovery.valueChanges.subscribe(() => this.pageOffset.set(0));
    this.wizard.target.valueChanges.subscribe(() => this.pageOffset.set(0));
  }

  setSort(sortBy: MealPlanSuggestionSort): void {
    this.wizard.discovery.controls.sortBy.setValue(sortBy);
  }

  reshuffleSuggestions(): void {
    if (this.filteredRecipes().length <= 5) {
      return;
    }

    this.pageOffset.update(value => value + 5);
  }

  selectRecipe(recipe: RecipeSummary): void {
    this.wizard.addRecipe(recipe);
  }

  removeRecipe(recipeId: number): void {
    this.wizard.removeSelectedMeal(recipeId);
  }

  beginReplacement(recipeId: number): void {
    this.wizard.beginReplacement(recipeId);
  }

  cancelReplacement(): void {
    this.wizard.cancelReplacement();
  }

  isSortSelected(sortBy: MealPlanSuggestionSort): boolean {
    return this.wizard.discovery.controls.sortBy.value === sortBy;
  }
}

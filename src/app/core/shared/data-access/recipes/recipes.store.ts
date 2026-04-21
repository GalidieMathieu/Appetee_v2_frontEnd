import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { EntityStore } from '../generic-template/entityStore';
import { RecipeDetailDto, RecipeSummary } from './recipe.model';

function toRecipeSummary(detail: RecipeDetailDto): RecipeSummary {
  const { instructions, ingredients, ...summary } = detail;

  return {
    ...summary,
    ingredients: ingredients.map(item => ({
      id: item.ingredient.id,
      name: item.ingredient.name,
    })),
  };
}

@Injectable({ providedIn: 'root' })
export class RecipesStore extends EntityStore<RecipeSummary[]> {

  //this is a list of recepies details. this list will only be used when we selected an recepies and want more details
  protected readonly recipeDetailsByIdSubject: BehaviorSubject<Record<number, RecipeDetailDto>>;
  readonly recipeDetailsById$: Observable<Record<number, RecipeDetailDto>>;

  constructor() {
    super([]);
    this.recipeDetailsByIdSubject = new BehaviorSubject<Record<number, RecipeDetailDto>>({});
    this.recipeDetailsById$ = this.recipeDetailsByIdSubject.asObservable();
  }

  getRecipeDetailsById(id: number): RecipeDetailDto | null {
    return this.recipeDetailsByIdSubject.value[id] ?? null;
  }

  setRecipeSummary(summary: RecipeSummary): void {
    const { [summary.id]: _removedRecipeDetail, ...remainingRecipeDetails } = this.recipeDetailsByIdSubject.value;

    this.recipeDetailsByIdSubject.next(remainingRecipeDetails);
    this.dataSubject.next(this.upsertRecipeSummary(summary));
    this.loadedSubject.next(true);
    this.stateSubject.next('success');
  }

  setRecipeDetails(detail: RecipeDetailDto): void {
    const summary = toRecipeSummary(detail);

    this.recipeDetailsByIdSubject.next({
      ...this.recipeDetailsByIdSubject.value,
      [detail.id]: detail,
    });
    this.dataSubject.next(this.upsertRecipeSummary(summary));
    this.loadedSubject.next(true);
    this.stateSubject.next('success');
  }

  protected initialValue(): RecipeSummary[] {
    return [];
  }

  private upsertRecipeSummary(summary: RecipeSummary): RecipeSummary[] {
    const currentRecipes = this.dataSubject.value;

    return currentRecipes.some(recipe => recipe.id === summary.id)
      ? currentRecipes.map(recipe => (recipe.id === summary.id ? summary : recipe))
      : [...currentRecipes, summary];
  }
}

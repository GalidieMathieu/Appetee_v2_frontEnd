import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { EntityStore } from '../generic-template/entityStore';
import { RecipeDetailDto, RecipeSummary } from './recipe.model';

function toRecipeSummary(detail: RecipeDetailDto): RecipeSummary {
  const { instructions, ...summary } = detail;
  return summary;
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

  setRecipeDetails(detail: RecipeDetailDto): void {
    const summary = toRecipeSummary(detail);
    const currentRecipes = this.dataSubject.value;
    const nextRecipes = currentRecipes.some(recipe => recipe.id === detail.id)
      ? currentRecipes.map(recipe => (recipe.id === detail.id ? summary : recipe))
      : [...currentRecipes, summary];

    this.recipeDetailsByIdSubject.next({
      ...this.recipeDetailsByIdSubject.value,
      [detail.id]: detail,
    });
    this.dataSubject.next(nextRecipes);
    this.loadedSubject.next(true);
    this.stateSubject.next('success');
  }

  protected initialValue(): RecipeSummary[] {
    return [];
  }
}

import { Injectable } from '@angular/core';

import { EntityStore } from '../generic-template/entityStore';
import { RecipeCardDto } from './recipe.model';

/** Whole-result state for the current recipe catalogue query; never stores full details. */
@Injectable({ providedIn: 'root' })
export class RecipesStore extends EntityStore<RecipeCardDto[]> {
  constructor() {
    super([]);
  }

  upsertCard(summary: RecipeCardDto): void {
    this.dataSubject.next(this.upsertRecipeSummary(summary));
    this.loadedSubject.next(true);
    this.stateSubject.next('success');
  }

  protected initialValue(): RecipeCardDto[] {
    return [];
  }

  private upsertRecipeSummary(summary: RecipeCardDto): RecipeCardDto[] {
    const currentRecipes = this.dataSubject.value;

    return currentRecipes.some(recipe => recipe.id === summary.id)
      ? currentRecipes.map(recipe => (recipe.id === summary.id ? summary : recipe))
      : [...currentRecipes, summary];
  }
}

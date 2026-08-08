import { Injectable } from '@angular/core';
import { EntityStore } from '../generic-template/entityStore';
import { Ingredient } from './ingredient.model';

/** Complete lightweight ingredient catalogue; never stores admin detail DTOs. */
@Injectable({ providedIn: 'root' })
export class IngredientsStore extends EntityStore<Ingredient[]> {
  constructor() {
    super([]);
  }

  upsert(ingredient: Ingredient): void {
    const currentIngredients = this.dataSubject.value;
    const nextIngredients = currentIngredients.some(current => current.id === ingredient.id)
      ? currentIngredients.map(current =>
          current.id === ingredient.id ? ingredient : current
        )
      : [...currentIngredients, ingredient];
    this.dataSubject.next(nextIngredients);
    this.loadedSubject.next(true);
    this.stateSubject.next('success');
  }

  protected initialValue(): Ingredient[] {
    return [];
  }
}

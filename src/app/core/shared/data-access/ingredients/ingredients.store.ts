import { Injectable } from '@angular/core';
import { EntityStore } from '../generic-template/entityStore';
import { Ingredient } from './ingredient.model';

@Injectable({ providedIn: 'root' })
export class IngredientsStore extends EntityStore<Ingredient[]> {
  constructor() {
    super([]);
  }

  protected initialValue(): Ingredient[] {
    return [];
  }
}

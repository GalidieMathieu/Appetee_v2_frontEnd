import { Injectable } from '@angular/core';
import { EntityStore } from '../generic-template/entityStore';
import { Ingredient, IngredientAdminDetailDto } from './ingredient.model';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class IngredientsStore extends EntityStore<Ingredient[]> {


/**
   * Internal subject storing cached ingredient details indexed by ingredient id.
   *
   * @remarks Acts as a local entity cache to avoid refetching ingredient details
   * from the API when they have already been loaded.
 */
  protected readonly ingredientDetailsByIdSubject: BehaviorSubject<Record<number, IngredientAdminDetailDto>>;
  readonly ingredientDetailsById$: Observable<Record<number, IngredientAdminDetailDto>>;

  constructor() {
    super([]);
    this.ingredientDetailsByIdSubject = new BehaviorSubject<Record<number, IngredientAdminDetailDto>>({});
    this.ingredientDetailsById$ = this.ingredientDetailsByIdSubject.asObservable();
  }

  getIngredientDetailsById(id: number): IngredientAdminDetailDto | null {
    return this.ingredientDetailsByIdSubject.value[id] ?? null;
  }

  setIngredientDetails(detail: IngredientAdminDetailDto): void {
    const ingredientSummary: Ingredient = {
      id: detail.id,
      name: detail.name,
    };
    const currentIngredients = this.dataSubject.value;
    const nextIngredients = currentIngredients.some(ingredient => ingredient.id === detail.id)
      ? currentIngredients.map(ingredient =>
          ingredient.id === detail.id ? ingredientSummary : ingredient
        )
      : [...currentIngredients, ingredientSummary];

    this.ingredientDetailsByIdSubject.next({
      ...this.ingredientDetailsByIdSubject.value,
      [detail.id]: detail,
    });
    this.dataSubject.next(nextIngredients);
    this.loadedSubject.next(true);
    this.stateSubject.next('success');
  }

  protected initialValue(): Ingredient[] {
    return [];
  }
} 

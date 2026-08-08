import { Injectable } from '@angular/core';
import { EMPTY, Observable, catchError, finalize, tap } from 'rxjs';

import { AbstractLoadFacade } from '../../generic-template/abstractLoadFacade';
import { AdminRecipeApi } from './admin-recipe.api';
import { AdminRecipeStore } from './admin-recipe.store';
import { RecipeCardDto, RecipeDetailRequest } from '../recipe.model';
import { RecipesFacade } from '../recipe.facade';

@Injectable({ providedIn: 'root' })
export class AdminRecipeFacade extends AbstractLoadFacade<null, AdminRecipeStore> {
  constructor(
    private readonly api: AdminRecipeApi,
    private readonly recipesFacade: RecipesFacade,
    store: AdminRecipeStore
  ) {
    super(store);
  }

  createRecipeWithDetails(recipe: RecipeDetailRequest): Observable<RecipeCardDto> {
    return this.runMutation(this.api.create(this.toRecipeFormData(recipe)));
  }

  updateRecipeWithDetails(
    id: number,
    recipe: RecipeDetailRequest
  ): Observable<RecipeCardDto> {
    return this.runMutation(this.api.update(id, this.toRecipeFormData(recipe)), id);
  }

  private runMutation(
    request$: Observable<RecipeCardDto>,
    changedId?: number
  ): Observable<RecipeCardDto> {
    if (this.store.isLoading()) return EMPTY;
    this.setLoading();

    return request$.pipe(
      tap(() => {
        if (changedId !== undefined) this.recipesFacade.invalidateDetail(changedId);
        this.recipesFacade.invalidateQueries();
      }),
      catchError((error: unknown) => {
        this.setError(this.toUserMessage(error));
        return EMPTY;
      }),
      finalize(() => {
        if (this.store.isLoading()) this.setSuccessWithNoData();
      })
    );
  }

  private toRecipeFormData(recipe: RecipeDetailRequest): FormData {
    const formData = new FormData();
    formData.append('name', recipe.name);
    formData.append('prepTimeMinutes', recipe.prepTimeMinutes.toString());
    formData.append('servings', recipe.servings.toString());
    formData.append('difficulty', recipe.difficulty);
    formData.append('caloriesTotal', recipe.caloriesTotal.toString());
    formData.append('proteinTotal', recipe.proteinTotal.toString());
    formData.append('carbsTotal', recipe.carbsTotal.toString());

    if (recipe.estimatedCostPerServing !== null) {
      formData.append('estimatedCostPerServing', recipe.estimatedCostPerServing.toString());
    }
    if (recipe.image) formData.append('image', recipe.image);
    recipe.badges.forEach((value, index) => formData.append(`badges[${index}]`, value));
    recipe.instructions.forEach((value, index) =>
      formData.append(`instructions[${index}]`, value)
    );
    recipe.dietIds.forEach((value, index) =>
      formData.append(`dietIds[${index}]`, value.toString())
    );
    recipe.ingredients.forEach((value, index) => {
      formData.append(`ingredients[${index}].ingredientId`, value.ingredientId.toString());
      if (value.quantity !== null) {
        formData.append(`ingredients[${index}].quantity`, value.quantity.toString());
      }
      if (value.unit !== null) formData.append(`ingredients[${index}].unit`, value.unit);
    });
    return formData;
  }
}

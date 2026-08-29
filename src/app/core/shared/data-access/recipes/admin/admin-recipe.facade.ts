/**
 * Coordinates Admin recipe multipart mutations and invalidates affected shared recipe caches.
 * Phase 12 invalidates the lightweight Preview independently from complete detail/discovery data.
 */
import { Injectable } from '@angular/core';
import { EMPTY, Observable, catchError, finalize, tap } from 'rxjs';

import { AbstractLoadFacade } from '../../generic-template/abstractLoadFacade';
import { AdminRecipeApi } from './admin-recipe.api';
import { AdminRecipeStore } from './admin-recipe.store';
import { RecipeDetailRequest, RecipeSummaryDto } from '../recipe.model';
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

  createRecipeWithDetails(recipe: RecipeDetailRequest): Observable<RecipeSummaryDto> {
    return this.runMutation(this.api.create(this.toRecipeFormData(recipe)));
  }

  updateRecipeWithDetails(
    id: number,
    recipe: RecipeDetailRequest
  ): Observable<RecipeSummaryDto> {
    return this.runMutation(this.api.update(id, this.toRecipeFormData(recipe)), id);
  }

  private runMutation(
    request$: Observable<RecipeSummaryDto>,
    changedId?: number
  ): Observable<RecipeSummaryDto> {
    if (this.store.isLoading()) return EMPTY;
    this.setLoading();

    return request$.pipe(
      tap(() => {
        if (changedId !== undefined) {
          this.recipesFacade.invalidateDetail(changedId);
          this.recipesFacade.invalidatePreview(changedId);
        }
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
    formData.append('description', recipe.description);
    formData.append('prepTimeMinutes', recipe.prepTimeMinutes.toString());
    formData.append('cookTimeMinutes', recipe.cookTimeMinutes.toString());
    formData.append('totalTimeMinutes', recipe.totalTimeMinutes.toString());
    formData.append('servings', recipe.servings.toString());
    formData.append('difficulty', recipe.difficulty);
    if (recipe.image) formData.append('image', recipe.image);
    recipe.badges.forEach((value, index) => formData.append(`badges[${index}]`, value));
    recipe.instructions.forEach((value, index) => {
      formData.append(`instructions[${index}].title`, value.title);
      formData.append(`instructions[${index}].instruction`, value.instruction);
    });
    recipe.dietIds.forEach((value, index) =>
      formData.append(`dietIds[${index}]`, value.toString())
    );
    recipe.ingredients.forEach((value, index) => {
      formData.append(`ingredients[${index}].ingredientId`, value.ingredientId.toString());
      if (value.quantity !== null) {
        formData.append(`ingredients[${index}].quantity`, value.quantity.toString());
      }
      if (value.unit !== null) formData.append(`ingredients[${index}].unit`, value.unit);
      if (value.featuredOrder !== null) {
        formData.append(
          `ingredients[${index}].featuredOrder`,
          value.featuredOrder.toString()
        );
      }
    });
    return formData;
  }
}

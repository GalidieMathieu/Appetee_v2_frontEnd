import { Injectable } from '@angular/core';
import { catchError, EMPTY, map, Observable, of, tap, timeout } from 'rxjs';

import { AbstractLoadFacade } from '../generic-template/abstractLoadFacade';
import { RecipeDetailDto, RecipeDetailRequest, RecipeSummary } from './recipe.model';
import { RecipesApi } from './recipe.api';
import { RecipesStore } from './recipes.store';

@Injectable({ providedIn: 'root' })
export class RecipesFacade extends AbstractLoadFacade<RecipeSummary[], RecipesStore> {
  constructor(
    private readonly api: RecipesApi,
    store: RecipesStore
  ) {
    super(store);
  }

  readonly recipes$ = this.data$.pipe(
    map(recipes => recipes as readonly RecipeSummary[])
  );

  loadIfNeeded(): void {
    if (this.isLoaded()) return;
    this.load();
  }

  reload(): void {
    this.reset();
    this.load();
  }

  load(): void {
    if (this.store.isLoading()) {
      return;
    }

    this.setLoading();

    this.api.getAll().pipe(
      timeout(10000),
      catchError((err: unknown) => {
        this.setError(this.toUserMessage(err));
        return EMPTY;
      })
    ).subscribe(data => this.setSuccess(data));
  }

  createRecipeWithDetails(recipeDetail: RecipeDetailRequest): Observable<RecipeSummary> {
    if (this.store.isLoading()) {
      return EMPTY;
    }

    this.setLoading();

    return this.api.createRecipeWithDetails(this.toRecipeCreateFormData(recipeDetail)).pipe(
      tap(recipe => this.store.setRecipeSummary(recipe)),
      catchError(err => {
        this.setError(this.toUserMessage(err));
        return EMPTY;
      })
    );
  }

  
  getRecipeWithDetails(id: number): Observable<RecipeDetailDto> {
    if (this.store.isLoading()) {
      return EMPTY;
    }

    const cached = this.store.getRecipeDetailsById(id);
    if (cached) {
      return of(cached);
    }

    this.setLoading();

    return this.api.getRecipeWithDetails(id).pipe(
      tap(recipe => this.store.setRecipeDetails(recipe)),
      catchError(err => {
        this.setError(this.toUserMessage(err));
        return EMPTY;
      })
    );
  }

  private toRecipeCreateFormData(recipe: RecipeDetailRequest): FormData {
    const formData = new FormData();

    formData.append('name', recipe.name);
    formData.append('image', recipe.image);
    formData.append('prepTimeMinutes', recipe.prepTimeMinutes.toString());
    formData.append('servings', recipe.servings.toString());
    formData.append('difficulty', recipe.difficulty);
    formData.append('freezerFriendly', recipe.freezerFriendly.toString());
    formData.append('caloriesTotal', recipe.caloriesTotal.toString());
    formData.append('proteinTotal', recipe.proteinTotal.toString());
    formData.append('carbsTotal', recipe.carbsTotal.toString());

    if (recipe.estimatedCostPerServing !== null) {
      formData.append('estimatedCostPerServing', recipe.estimatedCostPerServing.toString());
    }

    for (const instruction of recipe.instructions) {
      formData.append('instructions', instruction);
    }

    for (const dietId of recipe.dietIds) {
      formData.append('dietIds', dietId.toString());
    }

    for (const ingredient of recipe.ingredients) {
      formData.append('ingredients', JSON.stringify(ingredient));
    }

    console.log('FormData entries:');
    formData.forEach((value, key) => {
      console.log(`${key}: ${value}`);
    });
    return formData;
  }

}

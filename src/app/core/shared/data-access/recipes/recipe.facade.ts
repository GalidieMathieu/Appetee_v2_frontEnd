import { Injectable } from '@angular/core';
import { catchError, concatMap, defaultIfEmpty, EMPTY, from, map, Observable, of, switchMap, tap, timeout, toArray } from 'rxjs';

import { AbstractLoadFacade } from '../generic-template/abstractLoadFacade';
import { IngredientsFacade } from '../ingredients/ingredient.facade';
import { RecipeDetailDto, RecipeDetailRequest, RecipeSummary } from './recipe.model';
import { RecipesApi } from './recipe.api';
import { RecipesStore } from './recipes.store';

@Injectable({ providedIn: 'root' })
export class RecipesFacade extends AbstractLoadFacade<RecipeSummary[], RecipesStore> {
  constructor(
    private readonly api: RecipesApi,
    private readonly ingredientsFacade: IngredientsFacade,
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

    return this.api.createRecipeWithDetails(this.toRecipeFormData(recipeDetail)).pipe(
      tap(recipe => this.store.setRecipeSummary(recipe)),
      catchError(err => {
        this.setError(this.toUserMessage(err));
        return EMPTY;
      })
    );
  }

  updateRecipeWithDetails(id: number, recipeDetail: RecipeDetailRequest): Observable<RecipeSummary> {
    if (this.store.isLoading()) {
      return EMPTY;
    }

    this.setLoading();

    return this.api.updateRecipeWithDetails(id, this.toRecipeFormData(recipeDetail)).pipe(
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

  getRecipesWithDetails(id: number): Observable<RecipeDetailDto> {
    const cached = this.store.getRecipeDetailsById(id);
    if (cached) {
      return this.hydrateRecipeIngredients(cached).pipe(
        tap(recipe => this.store.setRecipeDetails(recipe))
      );
    }

    if (this.store.isLoading()) {
      return EMPTY;
    }

    this.setLoading();

    return this.api.getRecipeWithDetails(id).pipe(
      switchMap(recipe => this.hydrateRecipeIngredients(recipe)),
      tap(recipe => this.store.setRecipeDetails(recipe)),
      catchError(err => {
        this.setError(this.toUserMessage(err));
        return EMPTY;
      })
    );
  }

  private toRecipeFormData(recipe: RecipeDetailRequest): FormData {
    const formData = new FormData();

    formData.append('name', recipe.name);
    formData.append('instructions', recipe.instructions);
    formData.append('prepTimeMinutes', recipe.prepTimeMinutes.toString());
    formData.append('servings', recipe.servings.toString());
    formData.append('difficulty', recipe.difficulty);
    formData.append('caloriesTotal', recipe.caloriesTotal.toString());
    formData.append('proteinTotal', recipe.proteinTotal.toString());
    formData.append('carbsTotal', recipe.carbsTotal.toString());

    if (recipe.estimatedCostPerServing !== null) {
      formData.append('estimatedCostPerServing', recipe.estimatedCostPerServing.toString());
    }

    if (recipe.image) {
      formData.append('image', recipe.image);
    }

    recipe.badges.forEach((badge, index) => {
      formData.append(`badges[${index}]`, badge);
    });

    recipe.dietIds.forEach((dietId, index) => {
      formData.append(`dietIds[${index}]`, dietId.toString());
    });

    recipe.ingredients.forEach((ingredient, index) => {
      formData.append(`ingredients[${index}].ingredientId`, ingredient.ingredientId.toString());

      if (ingredient.quantity !== null) {
        formData.append(`ingredients[${index}].quantity`, ingredient.quantity.toString());
      }

      if (ingredient.unit !== null) {
        formData.append(`ingredients[${index}].unit`, ingredient.unit);
      }
    });

    return formData;
  }

  private hydrateRecipeIngredients(recipe: RecipeDetailDto): Observable<RecipeDetailDto> {
    if (recipe.ingredients.length === 0) {
      return of(recipe);
    }

    return from(recipe.ingredients).pipe(
      concatMap(recipeIngredient =>
        this.ingredientsFacade.getIngredientWithDetails(recipeIngredient.ingredientId).pipe(
          defaultIfEmpty(recipeIngredient.ingredient),
          map(ingredient => ({
            ...recipeIngredient,
            ingredient,
          }))
        )
      ),
      toArray(),
      map(ingredients => ({
        ...recipe,
        ingredients,
      }))
    );
  }
}

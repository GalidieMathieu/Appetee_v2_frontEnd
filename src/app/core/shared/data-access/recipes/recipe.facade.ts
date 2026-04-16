import { Injectable } from '@angular/core';
import { catchError, EMPTY, map, Observable, of, tap, timeout } from 'rxjs';

import { AbstractLoadFacade } from '../generic-template/abstractLoadFacade';
import { RecipeDetailDto, RecipeSummary } from './recipe.model';
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
}

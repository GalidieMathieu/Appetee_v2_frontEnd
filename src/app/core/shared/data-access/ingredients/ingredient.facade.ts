import { Injectable } from '@angular/core';
import { EMPTY, catchError, map, timeout } from 'rxjs';

import { AbstractLoadFacade } from '../generic-template/abstractLoadFacade';
import { Ingredient } from './ingredient.model';
import { IngredientsApi } from './ingredient.api';
import { IngredientsStore } from './ingredients.store';

/** Read-only facade for the lightweight ingredient catalogue. */
@Injectable({ providedIn: 'root' })
export class IngredientsFacade extends AbstractLoadFacade<Ingredient[], IngredientsStore> {
  constructor(private readonly api: IngredientsApi, store: IngredientsStore) {
    super(store);
  }

  readonly ingredients$ = this.data$.pipe(
    map(ingredients => ingredients as readonly Ingredient[])
  );

  loadIfNeeded(): void {
    if (!this.isLoaded()) this.load();
  }

  reload(): void {
    this.reset();
    this.load();
  }

  load(): void {
    if (this.store.isLoading()) return;
    this.setLoading();

    this.api.getAll().pipe(
      timeout(10000),
      catchError((error: unknown) => {
        this.setError(this.toUserMessage(error));
        return EMPTY;
      })
    ).subscribe(data => this.setSuccess(data));
  }
}

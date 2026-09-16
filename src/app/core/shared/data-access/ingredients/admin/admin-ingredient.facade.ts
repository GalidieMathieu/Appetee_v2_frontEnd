import { Injectable } from '@angular/core';
import { EMPTY, Observable, catchError, finalize, tap } from 'rxjs';

import { AbstractLoadFacade } from '../../generic-template/abstractLoadFacade';
import { AdminIngredientApi } from './admin-ingredient.api';
import { AdminIngredientStore } from './admin-ingredient.store';
import { IngredientDetailsStore } from './ingredient-details.store';
import {
  Ingredient,
  IngredientAdminDetailDto,
  IngredientAdminDetailRequest,
} from '../ingredient.model';
import { IngredientsStore } from '../ingredients.store';

@Injectable({ providedIn: 'root' })
export class AdminIngredientFacade extends AbstractLoadFacade<null, AdminIngredientStore> {
  constructor(
    private readonly api: AdminIngredientApi,
    private readonly catalogueStore: IngredientsStore,
    private readonly detailsStore: IngredientDetailsStore,
    store: AdminIngredientStore
  ) {
    super(store);
  }

  create(request: IngredientAdminDetailRequest): Observable<IngredientAdminDetailDto> {
    if (this.store.isLoading()) return EMPTY;
    this.setLoading();

    return this.api.create(this.toFormData(request)).pipe(
      tap(detail => {
        const item: Ingredient = { id: detail.id, name: detail.name };
        this.detailsStore.upsert(detail);
        this.catalogueStore.upsert(item);
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

  private toFormData(ingredient: IngredientAdminDetailRequest): FormData {
    const formData = new FormData();
    formData.append('name', ingredient.name);
    formData.append('basis', ingredient.basis.toString());
    formData.append('basisUnit', ingredient.basisUnit);
    formData.append('caloriesKcal', ingredient.caloriesKcal.toString());
    formData.append('price', ingredient.price.toString());
    formData.append('proteinG', ingredient.proteinG.toString());
    formData.append('carbsG', ingredient.carbsG.toString());
    formData.append('image', ingredient.image);

    const optionalNumbers: ReadonlyArray<
      readonly [string, number | null]
    > = [
      ['fatG', ingredient.fatG],
      ['sugarG', ingredient.sugarG],
      ['fiberG', ingredient.fiberG],
      ['sodiumMg', ingredient.sodiumMg],
      ['vitaminCMg', ingredient.vitaminCMg],
      ['ironMg', ingredient.ironMg],
    ];
    optionalNumbers.forEach(([key, value]) => {
      if (value !== null) formData.append(key, value.toString());
    });
    return formData;
  }
}

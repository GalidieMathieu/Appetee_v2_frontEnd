import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Observable, catchError, filter, finalize, map, takeUntil, tap, timeout } from 'rxjs';
import { CapabilitiesStore } from '@app/core/auth/data-access/capabilities.store';
import { CatalogueStateStore } from '../../catalogue/catalogue-state.store';

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
  private readonly capabilities = inject(CapabilitiesStore); private readonly catalogue = inject(CatalogueStateStore);
  constructor(
    private readonly api: AdminIngredientApi,
    private readonly catalogueStore: IngredientsStore,
    private readonly detailsStore: IngredientDetailsStore,
    store: AdminIngredientStore
  ) {
    super(store);
  }

  create(request: IngredientAdminDetailRequest): Observable<IngredientAdminDetailDto> {
    if (!this.capabilities.canWrite() || this.store.isLoading() || this.catalogue.ingredientCreateOutcomeUnknown()) return EMPTY;
    const generation = this.catalogue.generation();
    this.setLoading();

    return this.api.create(this.toFormData(request)).pipe(timeout(10000), filter(() => this.catalogue.generation() === generation),
      tap(record => this.catalogue.ingredients.update(records => ({ ...records, [record.resource.id]: record }))), map(record => record.resource),
      tap(detail => {
        const item: Ingredient = { id: detail.id, name: detail.name };
        this.detailsStore.upsert(detail);
        this.catalogueStore.upsert(item);
      }),
      catchError((error: unknown) => {
        if (this.catalogue.generation() === generation) {
          if (!(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500) this.catalogue.ingredientCreateOutcomeUnknown.set(true);
          this.setError(this.toUserMessage(error));
        }
        return EMPTY;
      }),
      takeUntil(this.catalogue.reset$), finalize(() => {
        if (this.catalogue.generation() === generation && this.store.isLoading()) this.setSuccessWithNoData();
      })
    );
  }
  confirmCreateReview(): void { if (this.capabilities.canWrite()) this.catalogue.ingredientCreateOutcomeUnknown.set(false); }

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

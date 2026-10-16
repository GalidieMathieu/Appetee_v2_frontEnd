import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CatalogueResource, CatalogueRecord, catalogueRecord } from '../../catalogue/catalogue-resource.model';

import { API_URL } from '@app/core/api/api.config';
import { IngredientAdminDetailDto } from '../ingredient.model';

@Injectable({ providedIn: 'root' })
export class AdminIngredientApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_URL) private readonly apiUrl: string
  ) {}

  getDetail(id: number): Observable<CatalogueRecord<IngredientAdminDetailDto>> {
    return this.http.get<CatalogueResource<IngredientAdminDetailDto>>(
      `${this.apiUrl}/admin/ingredient-details/${id}`, { observe: 'response' }
    ).pipe(map(response => catalogueRecord(response, 'ingredient', id)));
  }

  create(details: FormData): Observable<CatalogueRecord<IngredientAdminDetailDto>> {
    return this.http.post<CatalogueResource<IngredientAdminDetailDto>>(
      `${this.apiUrl}/admin/ingredient-details`, details, { observe: 'response' }
    ).pipe(map(response => catalogueRecord(response, 'ingredient')));
  }
}

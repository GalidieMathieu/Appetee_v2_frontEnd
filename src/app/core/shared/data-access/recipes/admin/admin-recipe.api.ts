import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_URL } from '@app/core/api/api.config';
import { RecipeDetailDto, RecipeSummaryDto } from '../recipe.model';
import { CatalogueResource, CatalogueRecord, catalogueRecord } from '../../catalogue/catalogue-resource.model';

@Injectable({ providedIn: 'root' })
export class AdminRecipeApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_URL) private readonly apiUrl: string
  ) {}

  getDetail(id: number): Observable<CatalogueRecord<RecipeDetailDto>> {
    return this.http.get<CatalogueResource<RecipeDetailDto>>(`${this.apiUrl}/admin/recipe-details/${id}`, { observe: 'response' })
      .pipe(map(response => catalogueRecord(response, 'recipe', id)));
  }
  create(recipeDetails: FormData): Observable<CatalogueRecord<RecipeSummaryDto>> {
    return this.http.post<CatalogueResource<RecipeSummaryDto>>(`${this.apiUrl}/admin/recipe-details`, recipeDetails, { observe: 'response' })
      .pipe(map(response => catalogueRecord(response, 'recipe')));
  }
  update(id: number, recipeDetails: FormData, etag: string): Observable<CatalogueRecord<RecipeSummaryDto>> {
    return this.http.put<CatalogueResource<RecipeSummaryDto>>(`${this.apiUrl}/admin/recipe-details/${id}`, recipeDetails,
      { observe: 'response', headers: new HttpHeaders().set('If-Match', etag) }).pipe(map(response => catalogueRecord(response, 'recipe', id)));
  }
}

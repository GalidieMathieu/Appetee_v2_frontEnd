import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '@app/core/api/api.config';
import { RecipeDetailDto, RecipeDiscoveryPageDto } from './recipe.model';

@Injectable({ providedIn: 'root' })
export class RecipesApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_URL) private readonly apiUrl: string
  ) {}

  /** Forwards the server-issued cursor unchanged; its contents are never interpreted here. */
  discover(cursor: string | null = null): Observable<RecipeDiscoveryPageDto> {
    const params = cursor === null
      ? new HttpParams()
      : new HttpParams().set('cursor', cursor);

    return this.http.get<RecipeDiscoveryPageDto>(`${this.apiUrl}/recipes`, { params });
  }

  getRecipeWithDetails(id: number): Observable<RecipeDetailDto> {
    return this.http.get<RecipeDetailDto>(`${this.apiUrl}/recipes/${id}`);
  }
}

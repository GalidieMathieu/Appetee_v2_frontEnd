/**
 * HTTP owner for recipe reads and mutations at the configured Appetee API boundary.
 * F-008 Phase 12 adds the dedicated lightweight Preview read beside discovery and full details.
 */
import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '@app/core/api/api.config';
import {
  RecipeDetailDto,
  RecipeDiscoveryCriteria,
  RecipeDiscoveryPageDto,
  RecipePreviewDto,
} from './recipe.model';

@Injectable({ providedIn: 'root' })
export class RecipesApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_URL) private readonly apiUrl: string
  ) {}

  /** Serializes applied criteria and forwards the opaque server cursor without interpreting it. */
  discover(
    criteria: RecipeDiscoveryCriteria = {
      search: '',
      ingredientIds: [],
      requireAllIngredients: true,
      badges: [],
      maxTotalMinutes: null,
      maxDifficulty: null,
      savedOnly: false,
    },
    cursor: string | null = null
  ): Observable<RecipeDiscoveryPageDto> {
    let params = new HttpParams();
    if (criteria.search) params = params.set('search', criteria.search);
    for (const ingredientId of criteria.ingredientIds) {
      params = params.append('ingredientIds', ingredientId);
    }
    if (criteria.ingredientIds.length > 0 && !criteria.requireAllIngredients) {
      params = params.set('requireAllIngredients', false);
    }
    for (const badge of criteria.badges) params = params.append('badges', badge);
    if (criteria.maxTotalMinutes !== null) {
      params = params.set('maxTotalMinutes', criteria.maxTotalMinutes);
    }
    if (criteria.maxDifficulty !== null) {
      params = params.set('maxDifficulty', criteria.maxDifficulty);
    }
    if (criteria.savedOnly) params = params.set('savedOnly', true);
    if (cursor !== null) params = params.set('cursor', cursor);

    return this.http.get<RecipeDiscoveryPageDto>(`${this.apiUrl}/recipes`, { params });
  }

  saveFavorite(id: number): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/recipes/${id}/favorite`, null);
  }

  removeFavorite(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/recipes/${id}/favorite`);
  }

  getPreview(id: number): Observable<RecipePreviewDto> {
    return this.http.get<RecipePreviewDto>(`${this.apiUrl}/recipes/${id}/preview`);
  }

  getRecipeWithDetails(id: number): Observable<RecipeDetailDto> {
    return this.http.get<RecipeDetailDto>(`${this.apiUrl}/recipes/${id}`);
  }
}

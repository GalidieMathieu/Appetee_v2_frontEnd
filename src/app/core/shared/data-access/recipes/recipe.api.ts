/**
 * HTTP owner for recipe reads and mutations at the configured Appetee API boundary.
 * Discovery, Favorites, Preview, and detail consumers share this credential-scoped boundary.
 */
import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '@app/core/api/api.config';
import {
  RecipeCardDto,
  RecipeCookingViewDto,
  RecipeDetailDto,
  RecipeDiscoveryCriteria,
  RecipeDiscoveryPageDto,
  RecipeMealPlanPageDto,
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
    criteria: RecipeDiscoveryCriteria = DEFAULT_DISCOVERY_CRITERIA,
    cursor: string | null = null,
    limit?: number
  ): Observable<RecipeDiscoveryPageDto> {
    const params = buildDiscoveryParams(criteria, cursor, limit);
    return this.http.get<RecipeDiscoveryPageDto>(`${this.apiUrl}/recipes`, { params });
  }

  /** Uses the same bounded discovery contract with the Meal Plan picker projection. */
  discoverForMealPlan(
    criteria: RecipeDiscoveryCriteria = DEFAULT_DISCOVERY_CRITERIA,
    cursor: string | null = null,
    limit?: number
  ): Observable<RecipeMealPlanPageDto> {
    const params = buildDiscoveryParams(criteria, cursor, limit);
    return this.http.get<RecipeMealPlanPageDto>(`${this.apiUrl}/recipes/meal-plan`, { params });
  }

  saveFavorite(id: number): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/recipes/${id}/favorite`, null);
  }

  removeFavorite(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/recipes/${id}/favorite`);
  }

  /** Reads the current user's compatible favorites without sending browser-owned identity data. */
  getFavorites(limit?: number): Observable<readonly RecipeCardDto[]> {
    const params = limit === undefined
      ? undefined
      : new HttpParams().set('limit', limit);
    return this.http.get<readonly RecipeCardDto[]>(
      `${this.apiUrl}/recipes/favorites`,
      params ? { params } : {}
    );
  }

  getPreview(id: number): Observable<RecipePreviewDto> {
    return this.http.get<RecipePreviewDto>(`${this.apiUrl}/recipes/${id}/preview`);
  }

  /** Loads the authenticated user's complete compatible Cooking View without client identity data. */
  getCookingView(id: number): Observable<RecipeCookingViewDto> {
    return this.http.get<RecipeCookingViewDto>(
      `${this.apiUrl}/recipes/${id}/cooking-view`
    );
  }

  getRecipeWithDetails(id: number): Observable<RecipeDetailDto> {
    return this.http.get<RecipeDetailDto>(`${this.apiUrl}/recipes/${id}`);
  }
}

const DEFAULT_DISCOVERY_CRITERIA: RecipeDiscoveryCriteria = {
  search: '',
  ingredientIds: [],
  requireAllIngredients: true,
  badges: [],
  maxTotalMinutes: null,
  maxDifficulty: null,
  savedOnly: false,
};

function buildDiscoveryParams(
  criteria: RecipeDiscoveryCriteria,
  cursor: string | null,
  limit?: number
): HttpParams {
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
  if (limit !== undefined) params = params.set('limit', limit);
  return params;
}

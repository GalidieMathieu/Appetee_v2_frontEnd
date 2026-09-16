/**
 * Shared lightweight ingredient HTTP access for complete-catalogue consumers and bounded search.
 * Recipe autocomplete belongs here so feature components do not duplicate API URL construction.
 */
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, Inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../../../api/api.config';
import { Ingredient } from './ingredient.model';

@Injectable({ providedIn: 'root' })
export class IngredientsApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_URL) private readonly apiUrl: string
  ) {}

  getAll(): Observable<Ingredient[]> {
    return this.http.get<Ingredient[]>(`${this.apiUrl}/ingredients`);
  }

  /** Requests the server-bounded lightweight ID/name projection used by autocomplete. */
  search(search: string, limit: number): Observable<Ingredient[]> {
    const params = new HttpParams()
      .set('search', search)
      .set('limit', limit);
    return this.http.get<Ingredient[]>(`${this.apiUrl}/ingredients`, { params });
  }
}

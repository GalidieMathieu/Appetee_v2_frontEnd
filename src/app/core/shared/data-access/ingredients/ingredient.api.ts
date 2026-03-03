import { HttpClient } from '@angular/common/http';
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
}

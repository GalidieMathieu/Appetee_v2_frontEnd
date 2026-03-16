import { HttpClient } from '@angular/common/http';
import { Injectable, Inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../../api/api.config';
import { Ingredient, IngredientAdminDetailDto, IngredientAdminDetailRequest } from './ingredient.model';

@Injectable({ providedIn: 'root' })
export class IngredientsApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_URL) private readonly apiUrl: string
  ) {}

  getAll(): Observable<Ingredient[]> {
    return this.http.get<Ingredient[]>(`${this.apiUrl}/ingredients`);
  }


  //Admin request
  createIngredientWithDetails(ingredientDetails: IngredientAdminDetailRequest): Observable<IngredientAdminDetailDto> {
    return this.http.post<IngredientAdminDetailDto>(`${this.apiUrl}/admin/ingredient-details`, ingredientDetails);
  }

  getIngredientWithDetails(id: number): Observable<IngredientAdminDetailDto> {
    return this.http.get<IngredientAdminDetailDto>(`${this.apiUrl}/admin/ingredient-details/${id}`);
  }
}

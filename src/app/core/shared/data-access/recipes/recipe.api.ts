import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '@app/core/api/api.config';
import { RecipeCardDto, RecipeDetailDto } from './recipe.model';

@Injectable({ providedIn: 'root' })
export class RecipesApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_URL) private readonly apiUrl: string
  ) {}

  //the get All function should almost never use except for admin
  getAll(): Observable<RecipeCardDto[]> {
    return this.http.get<RecipeCardDto[]>(`${this.apiUrl}/recipes`);
  }

  getRecipeWithDetails(id: number): Observable<RecipeDetailDto> {
    return this.http.get<RecipeDetailDto>(`${this.apiUrl}/recipes/${id}`);
  }

}

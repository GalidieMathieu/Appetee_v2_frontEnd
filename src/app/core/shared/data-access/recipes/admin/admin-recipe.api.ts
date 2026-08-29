import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '@app/core/api/api.config';
import { RecipeSummaryDto } from '../recipe.model';

@Injectable({ providedIn: 'root' })
export class AdminRecipeApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_URL) private readonly apiUrl: string
  ) {}

  create(recipeDetails: FormData): Observable<RecipeSummaryDto> {
    return this.http.post<RecipeSummaryDto>(`${this.apiUrl}/admin/recipe-details`, recipeDetails);
  }

  update(id: number, recipeDetails: FormData): Observable<RecipeSummaryDto> {
    return this.http.put<RecipeSummaryDto>(`${this.apiUrl}/admin/recipe-details/${id}`, recipeDetails);
  }
}

import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '@app/core/api/api.config';
import { IngredientAdminDetailDto } from '../ingredient.model';

@Injectable({ providedIn: 'root' })
export class AdminIngredientApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_URL) private readonly apiUrl: string
  ) {}

  getDetail(id: number): Observable<IngredientAdminDetailDto> {
    return this.http.get<IngredientAdminDetailDto>(
      `${this.apiUrl}/admin/ingredient-details/${id}`
    );
  }

  create(details: FormData): Observable<IngredientAdminDetailDto> {
    return this.http.post<IngredientAdminDetailDto>(
      `${this.apiUrl}/admin/ingredient-details`,
      details
    );
  }
}

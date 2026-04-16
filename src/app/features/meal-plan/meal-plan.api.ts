import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '@app/core/api/api.config';

import {
  MealPlanCalculation,
  MealPlanCard,
  MealPlanDetail,
  MealPlanPreviewRequest,
  MealPlanSaveRequest,
} from './meal-plan.model';

@Injectable({ providedIn: 'root' })
export class MealPlanApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_URL) private readonly apiUrl: string
  ) {}

  getAll(): Observable<MealPlanCard[]> {
    return this.http.get<MealPlanCard[]>(`${this.apiUrl}/meal-plans`);
  }

  getMealPlanById(id: number): Observable<MealPlanDetail> {
    return this.http.get<MealPlanDetail>(`${this.apiUrl}/meal-plans/${id}`);
  }

  previewMealPlan(request: MealPlanPreviewRequest): Observable<MealPlanCalculation> {
    return this.http.post<MealPlanCalculation>(`${this.apiUrl}/meal-plans/preview`, request);
  }

  createMealPlan(request: MealPlanSaveRequest): Observable<MealPlanDetail> {
    return this.http.post<MealPlanDetail>(`${this.apiUrl}/meal-plans`, request);
  }

  updateMealPlan(id: number, request: MealPlanSaveRequest): Observable<MealPlanDetail> {
    return this.http.put<MealPlanDetail>(`${this.apiUrl}/meal-plans/${id}`, request);
  }

  deleteMealPlan(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/meal-plans/${id}`);
  }
}

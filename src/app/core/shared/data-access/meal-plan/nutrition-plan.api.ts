import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '@app/core/api/api.config';
import { MealPlanRevision } from './meal-plan.model';
import { MEAL_PLAN_REVISION_HEADER } from './meal-plan-mutation.model';
import {
  CreateNutritionPlanRequest,
  NutritionCalculationDto,
  NutritionCalculationRequest,
  NutritionPlanDetailDto,
  NutritionPlanListDto,
  NutritionPlanMutationDto,
  SetCurrentNutritionPlanRequest,
  UpdateNutritionPlanRequest,
} from './nutrition-plan.model';

@Injectable({ providedIn: 'root' })
export class NutritionPlanApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_URL) private readonly apiUrl: string
  ) {}

  previewCalculation(request: NutritionCalculationRequest): Observable<NutritionCalculationDto> {
    return this.http.post<NutritionCalculationDto>(
      `${this.apiUrl}/nutrition-plans/calculation-preview`,
      request
    );
  }

  getPlans(): Observable<NutritionPlanListDto> {
    return this.http.get<NutritionPlanListDto>(`${this.apiUrl}/nutrition-plans`);
  }

  getPlan(planId: number): Observable<NutritionPlanDetailDto> {
    return this.http.get<NutritionPlanDetailDto>(`${this.apiUrl}/nutrition-plans/${planId}`);
  }

  createPlan(
    request: CreateNutritionPlanRequest,
    expectedRevision: MealPlanRevision
  ): Observable<NutritionPlanMutationDto> {
    return this.http.post<NutritionPlanMutationDto>(
      `${this.apiUrl}/nutrition-plans`,
      request,
      revisionOptions(expectedRevision)
    );
  }

  updatePlan(
    planId: number,
    request: UpdateNutritionPlanRequest,
    expectedRevision: MealPlanRevision
  ): Observable<NutritionPlanMutationDto> {
    return this.http.put<NutritionPlanMutationDto>(
      `${this.apiUrl}/nutrition-plans/${planId}`,
      request,
      revisionOptions(expectedRevision)
    );
  }

  duplicatePlan(
    planId: number,
    expectedRevision: MealPlanRevision
  ): Observable<NutritionPlanMutationDto> {
    return this.http.post<NutritionPlanMutationDto>(
      `${this.apiUrl}/nutrition-plans/${planId}/duplicate`,
      null,
      revisionOptions(expectedRevision)
    );
  }

  deletePlan(
    planId: number,
    expectedRevision: MealPlanRevision
  ): Observable<NutritionPlanMutationDto> {
    return this.http.delete<NutritionPlanMutationDto>(
      `${this.apiUrl}/nutrition-plans/${planId}`,
      revisionOptions(expectedRevision)
    );
  }

  setCurrentPlan(
    request: SetCurrentNutritionPlanRequest,
    expectedRevision: MealPlanRevision
  ): Observable<NutritionPlanMutationDto> {
    return this.http.put<NutritionPlanMutationDto>(
      `${this.apiUrl}/meal-plan/current-nutrition-plan`,
      request,
      revisionOptions(expectedRevision)
    );
  }
}

function revisionOptions(expectedRevision: MealPlanRevision): { headers: HttpHeaders } {
  return {
    headers: new HttpHeaders().set(MEAL_PLAN_REVISION_HEADER, expectedRevision),
  };
}

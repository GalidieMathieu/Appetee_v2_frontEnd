/** Claim-scoped browser access to the current user's profile and account lifecycle. */
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, Inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../../api/api.config';
import { ExistsResponse, UpdateCurrentUserRequest, User } from './user.model';
import { MealPlanRevision } from '../meal-plan/meal-plan.model';
import { MEAL_PLAN_REVISION_HEADER } from '../meal-plan/meal-plan-mutation.model';
import { NutritionProfileDto, NutritionProfileRequest } from './nutrition-profile.model';

@Injectable({ providedIn: 'root' })
export class UserApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_URL) private readonly apiUrl: string
  ) {}

  getMe(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/me`);
  }

  updateMe(request: UpdateCurrentUserRequest): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/me`, request);
  }

  deleteMe(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/users/me`);
  }

  getNutritionProfile(): Observable<NutritionProfileDto> {
    return this.http.get<NutritionProfileDto>(`${this.apiUrl}/users/me/nutrition-profile`);
  }

  updateNutritionProfile(
    request: NutritionProfileRequest,
    expectedRevision: MealPlanRevision
  ): Observable<NutritionProfileDto> {
    const headers = new HttpHeaders().set(MEAL_PLAN_REVISION_HEADER, expectedRevision);
    return this.http.put<NutritionProfileDto>(
      `${this.apiUrl}/users/me/nutrition-profile`,
      request,
      { headers }
    );
  }

  checkUserExist(email: string): Observable<ExistsResponse> {
    return this.http.get<ExistsResponse>(`${this.apiUrl}/auth/exists-by-email`, { params: { email } });
  }
}

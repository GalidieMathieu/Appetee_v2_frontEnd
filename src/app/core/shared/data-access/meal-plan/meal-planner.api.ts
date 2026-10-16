import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '@app/core/api/api.config';
import { MealPlanDate, MealPlanRevision, MealPlannerRangeDto } from './meal-plan.model';
import { AddManualItemRequest, AddRecipeItemRequest, CopyDayRequest, CopyWeekRequest, CreateMealRequest, ManualItemRequest, MEAL_PLAN_REVISION_HEADER, PlannerMutationDto, RenameMealRequest, ReorderRequest, SetRecipeQuantityRequest, } from './meal-plan-mutation.model';
@Injectable({ providedIn: 'root' })
export class MealPlannerApi {
    constructor(private readonly http: HttpClient,
    @Inject(API_URL)
    private readonly apiUrl: string) { }
    getRange(from: MealPlanDate, through: MealPlanDate): Observable<MealPlannerRangeDto> {
        const params = new HttpParams().set('from', from).set('through', through);
        return this.http.get<MealPlannerRangeDto>(`${this.apiUrl}/meal-plan/days`, { params });
    }
    createMeal(date: MealPlanDate, request: CreateMealRequest, expectedRevision: MealPlanRevision): Observable<PlannerMutationDto> {
        return this.http.post<PlannerMutationDto>(`${this.apiUrl}/meal-plan/days/${date}/meals`, request, revisionOptions(expectedRevision));
    }
    renameMeal(mealId: number, request: RenameMealRequest, expectedRevision: MealPlanRevision): Observable<PlannerMutationDto> {
        return this.http.patch<PlannerMutationDto>(`${this.apiUrl}/meal-plan/meals/${mealId}`, request, revisionOptions(expectedRevision));
    }
    deleteMeal(mealId: number, expectedRevision: MealPlanRevision): Observable<PlannerMutationDto> {
        return this.http.delete<PlannerMutationDto>(`${this.apiUrl}/meal-plan/meals/${mealId}`, revisionOptions(expectedRevision));
    }
    reorderMeals(date: MealPlanDate, request: ReorderRequest, expectedRevision: MealPlanRevision): Observable<PlannerMutationDto> {
        return this.http.put<PlannerMutationDto>(`${this.apiUrl}/meal-plan/days/${date}/meal-order`, request, revisionOptions(expectedRevision));
    }
    addRecipeItem(date: MealPlanDate, request: AddRecipeItemRequest, expectedRevision: MealPlanRevision): Observable<PlannerMutationDto> {
        return this.http.post<PlannerMutationDto>(`${this.apiUrl}/meal-plan/days/${date}/recipe-items`, request, revisionOptions(expectedRevision));
    }
    setRecipeQuantity(itemId: number, request: SetRecipeQuantityRequest, expectedRevision: MealPlanRevision): Observable<PlannerMutationDto> {
        return this.http.put<PlannerMutationDto>(`${this.apiUrl}/meal-plan/recipe-items/${itemId}/quantity`, request, revisionOptions(expectedRevision));
    }
    addManualItem(date: MealPlanDate, request: AddManualItemRequest, expectedRevision: MealPlanRevision): Observable<PlannerMutationDto> {
        return this.http.post<PlannerMutationDto>(`${this.apiUrl}/meal-plan/days/${date}/manual-items`, request, revisionOptions(expectedRevision));
    }
    updateManualItem(itemId: number, request: ManualItemRequest, expectedRevision: MealPlanRevision): Observable<PlannerMutationDto> {
        return this.http.put<PlannerMutationDto>(`${this.apiUrl}/meal-plan/manual-items/${itemId}`, request, revisionOptions(expectedRevision));
    }
    deleteItem(itemId: number, expectedRevision: MealPlanRevision): Observable<PlannerMutationDto> {
        return this.http.delete<PlannerMutationDto>(`${this.apiUrl}/meal-plan/items/${itemId}`, revisionOptions(expectedRevision));
    }
    reorderItems(mealId: number, request: ReorderRequest, expectedRevision: MealPlanRevision): Observable<PlannerMutationDto> {
        return this.http.put<PlannerMutationDto>(`${this.apiUrl}/meal-plan/meals/${mealId}/item-order`, request, revisionOptions(expectedRevision));
    }
    copyDay(request: CopyDayRequest, expectedRevision: MealPlanRevision): Observable<PlannerMutationDto> {
        return this.http.post<PlannerMutationDto>(`${this.apiUrl}/meal-plan/copy-day`, request, revisionOptions(expectedRevision));
    }
    copyWeek(request: CopyWeekRequest, expectedRevision: MealPlanRevision): Observable<PlannerMutationDto> {
        return this.http.post<PlannerMutationDto>(`${this.apiUrl}/meal-plan/copy-week`, request, revisionOptions(expectedRevision));
    }
}
function revisionOptions(expectedRevision: MealPlanRevision): {
    headers: HttpHeaders;
} {
    return {
        headers: new HttpHeaders().set(MEAL_PLAN_REVISION_HEADER, expectedRevision),
    };
}

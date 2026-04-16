import { Injectable } from '@angular/core';
import { catchError, EMPTY, map, Observable, of, tap, timeout } from 'rxjs';

import { AbstractLoadFacade } from '@app/core/shared/data-access/generic-template/abstractLoadFacade';

import {
  MealPlanCalculation,
  MealPlanCard,
  MealPlanDetail,
  MealPlanPreviewRequest,
  MealPlanSaveRequest,
} from './meal-plan.model';
import { MealPlanApi } from './meal-plan.api';
import { MealPlanStore } from './meal-plan.store';

@Injectable({ providedIn: 'root' })
export class MealPlanFacade extends AbstractLoadFacade<MealPlanCard[], MealPlanStore> {
  constructor(
    private readonly api: MealPlanApi,
    store: MealPlanStore
  ) {
    super(store);
  }

  readonly mealPlans$ = this.data$.pipe(
    map(mealPlans => mealPlans as readonly MealPlanCard[])
  );

  loadIfNeeded(): void {
    if (this.isLoaded()) return;
    this.load();
  }

  reload(): void {
    this.reset();
    this.load();
  }

  load(): void {
    if (this.store.isLoading()) {
      return;
    }

    this.setLoading();

    this.api.getAll().pipe(
      timeout(10000),
      catchError((err: unknown) => {
        this.setError(this.toUserMessage(err));
        return EMPTY;
      })
    ).subscribe(mealPlans => this.store.setMealPlans(mealPlans));
  }

  getMealPlanDetail(id: number): Observable<MealPlanDetail> {
    if (this.store.isLoading()) {
      return EMPTY;
    }

    const cached = this.store.getMealPlanDetailsById(id);
    if (cached) {
      return of(cached);
    }

    this.setLoading();

    return this.api.getMealPlanById(id).pipe(
      timeout(10000),
      tap(mealPlan => this.store.setMealPlanDetails(mealPlan)),
      catchError(err => {
        this.setError(this.toUserMessage(err));
        return EMPTY;
      })
    );
  }

  previewMealPlan(request: MealPlanPreviewRequest): Observable<MealPlanCalculation> {
    if (this.store.isLoading()) {
      return EMPTY;
    }

    this.setLoading();

    return this.api.previewMealPlan(request).pipe(
      timeout(10000),
      tap(() => this.setSuccessWithNoData()),
      catchError(err => {
        this.setError(this.toUserMessage(err));
        return EMPTY;
      })
    );
  }

  saveMealPlan(request: MealPlanSaveRequest): Observable<MealPlanDetail> {
    if (this.store.isLoading()) {
      return EMPTY;
    }

    this.setLoading();

    const request$ = request.id
      ? this.api.updateMealPlan(request.id, request)
      : this.api.createMealPlan(request);

    return request$.pipe(
      timeout(10000),
      tap(mealPlan => this.store.setMealPlanDetails(mealPlan)),
      catchError(err => {
        this.setError(this.toUserMessage(err));
        return EMPTY;
      })
    );
  }

  deleteMealPlan(id: number): Observable<void> {
    if (this.store.isLoading()) {
      return EMPTY;
    }

    this.setLoading();

    return this.api.deleteMealPlan(id).pipe(
      timeout(10000),
      tap(() => this.store.removeMealPlan(id)),
      catchError(err => {
        this.setError(this.toUserMessage(err));
        return EMPTY;
      })
    );
  }
}

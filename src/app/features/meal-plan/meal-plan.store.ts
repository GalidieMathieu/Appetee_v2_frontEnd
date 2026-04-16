import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { EntityStore } from '@app/core/shared/data-access/generic-template/entityStore';

import { MealPlanCard, MealPlanDetail } from './meal-plan.model';
import { toMealPlanCard } from './meal-plan.utils';

@Injectable({ providedIn: 'root' })
export class MealPlanStore extends EntityStore<MealPlanCard[]> {
  protected readonly mealPlanDetailsByIdSubject: BehaviorSubject<Record<number, MealPlanDetail>>;
  readonly mealPlanDetailsById$: Observable<Record<number, MealPlanDetail>>;

  constructor() {
    super([]);
    this.mealPlanDetailsByIdSubject = new BehaviorSubject<Record<number, MealPlanDetail>>({});
    this.mealPlanDetailsById$ = this.mealPlanDetailsByIdSubject.asObservable();
  }

  getMealPlans(): MealPlanCard[] {
    return this.dataSubject.value;
  }

  getMealPlanDetailsById(id: number): MealPlanDetail | null {
    return this.mealPlanDetailsByIdSubject.value[id] ?? null;
  }

  setMealPlans(mealPlans: MealPlanCard[]): void {
    this.dataSubject.next(mealPlans);
    this.errorSubject.next(null);
    this.loadedSubject.next(true);
    this.stateSubject.next('success');
  }

  setMealPlanDetails(detail: MealPlanDetail): void {
    const card = toMealPlanCard(detail);
    const currentMealPlans = this.dataSubject.value;
    const nextMealPlans = currentMealPlans.some(item => item.id === detail.id)
      ? currentMealPlans.map(item => (item.id === detail.id ? card : item))
      : [card, ...currentMealPlans];

    this.mealPlanDetailsByIdSubject.next({
      ...this.mealPlanDetailsByIdSubject.value,
      [detail.id]: detail,
    });
    this.dataSubject.next(nextMealPlans);
    this.errorSubject.next(null);
    this.loadedSubject.next(true);
    this.stateSubject.next('success');
  }

  removeMealPlan(id: number): void {
    const nextDetails = { ...this.mealPlanDetailsByIdSubject.value };
    delete nextDetails[id];

    this.mealPlanDetailsByIdSubject.next(nextDetails);
    this.dataSubject.next(this.dataSubject.value.filter(item => item.id !== id));
    this.errorSubject.next(null);
    this.loadedSubject.next(true);
    this.stateSubject.next('success');
  }

  protected initialValue(): MealPlanCard[] {
    return [];
  }
}

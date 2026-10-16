import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MealPlanContextStore } from '@app/core/shared/data-access/meal-plan/meal-plan-context.store';
import { PlannerDayDto, PlannerMealDto } from '@app/core/shared/data-access/meal-plan/meal-plan.model';

/** UI-only suggestions, never merged into the confirmed Core projection or persisted. */
@Injectable({ providedIn: 'root' })
export class PlannerSessionSlotsState {
  private readonly slots = signal<ReadonlyMap<string, readonly PlannerMealDto[]>>(new Map());
  private readonly materializations = new Map<string, number>();

  constructor() {
    inject(MealPlanContextStore).reset$.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => { this.slots.set(new Map()); this.materializations.clear(); });
  }

  remember(day: PlannerDayDto): void {
    if (day.persistence !== 'untouched') return;
    const meals = day.meals.filter(meal => meal.isVirtual);
    const previous = this.slots().get(day.date);
    if (previous?.map(meal => meal.key + ':' + meal.name).join('|') === meals.map(meal => meal.key + ':' + meal.name).join('|')) return;
    this.slots.update(current => new Map(current).set(day.date, meals));
  }

  project(day: PlannerDayDto): PlannerDayDto {
    const slots = this.slots().get(day.date);
    if (day.persistence !== 'saved' || !slots?.length) return day;
    return { ...day, meals: [...day.meals, ...slots] };
  }

  consume(date: string, slot: number, id: number): void {
    this.materializations.set(date + ':' + slot, id);
    this.slots.update(current => new Map(current).set(date,
      (current.get(date) ?? []).filter(meal => meal.defaultSlot !== slot)));
  }

  alias(date: string, slot: number): number | null { return this.materializations.get(date + ':' + slot) ?? null; }

  forget(dates: readonly string[]): void {
    this.slots.update(current => {
      const next = new Map(current);
      for (const date of dates) {
        next.delete(date);
        for (const key of this.materializations.keys()) if (key.startsWith(date + ':')) this.materializations.delete(key);
      }
      return next;
    });
  }
}

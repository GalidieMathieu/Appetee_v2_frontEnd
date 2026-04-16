import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { startWith } from 'rxjs';

import { MealPlanDeleteDialogComponent } from './components/meal-plan-delete.dialog';
import { MealPlanFacade } from './meal-plan.facade';
import { MealPlanBadge, MealPlanCard } from './meal-plan.model';

type BadgeFilter = 'all' | MealPlanBadge;

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatDialogModule, MatIconModule],
  templateUrl: './meal-plan.page.html',
  styleUrl: './meal-plan.page.scss',
})
export class MealPlanPageComponent implements OnInit {
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly badgeFilterControl = new FormControl<BadgeFilter>('all', { nonNullable: true });
  readonly loadingCards = Array.from({ length: 3 }, (_, index) => index);
  readonly badgeFilters: Array<{ value: BadgeFilter; label: string }> = [
    { value: 'all', label: 'All Plans' },
    { value: 'freezer-friendly', label: 'Freezer-Friendly' },
    { value: 'budget-focused', label: 'Budget-Focused' },
    { value: 'high protein', label: 'High Protein' },
  ];

  private readonly facade = inject(MealPlanFacade);
  private readonly dialog = inject(MatDialog);

  readonly mealPlans = toSignal(this.facade.mealPlans$, {
    initialValue: [] as MealPlanCard[],
  });
  readonly loadState = toSignal(this.facade.state$, { initialValue: 'idle' });
  readonly search = toSignal(
    this.searchControl.valueChanges.pipe(startWith(this.searchControl.value)),
    { initialValue: this.searchControl.value }
  );
  readonly badgeFilter = toSignal(
    this.badgeFilterControl.valueChanges.pipe(startWith(this.badgeFilterControl.value)),
    { initialValue: this.badgeFilterControl.value }
  );

  readonly isLoading = computed(
    () => this.loadState() === 'loading' && this.mealPlans().length === 0
  );
  readonly hasSavedMealPlans = computed(() => this.mealPlans().length > 0);
  readonly filteredMealPlans = computed(() => {
    const searchTerm = this.search().trim().toLowerCase();
    const badgeFilter = this.badgeFilter();

    return this.mealPlans().filter(mealPlan => {
      const matchesSearch =
        searchTerm.length === 0 ||
        mealPlan.name.toLowerCase().includes(searchTerm) ||
        mealPlan.badges.some(badge => badge.includes(searchTerm));
      const matchesBadge =
        badgeFilter === 'all' || mealPlan.badges.includes(badgeFilter as MealPlanBadge);

      return matchesSearch && matchesBadge;
    });
  });

  ngOnInit(): void {
    this.facade.loadIfNeeded();
  }

  setBadgeFilter(value: BadgeFilter): void {
    this.badgeFilterControl.setValue(value);
  }

  openDeleteDialog(mealPlan: MealPlanCard): void {
    const dialogRef = this.dialog.open(MealPlanDeleteDialogComponent, {
      data: { mealPlanName: mealPlan.name },
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) {
        return;
      }

      this.facade.deleteMealPlan(mealPlan.id).subscribe();
    });
  }
}

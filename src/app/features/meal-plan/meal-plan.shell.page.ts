import { Component, DestroyRef, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';

import { MealPlanFacade } from './meal-plan.facade';
import { MealPlanWizard } from './meal-plan.wizard';

@Component({
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  templateUrl: './meal-plan.shell.page.html',
  styleUrl: './meal-plan.shell.page.scss',
})
export class MealPlanShellPageComponent implements OnInit, OnDestroy {
  private readonly steps = ['target', 'recipes', 'preview', 'shopping'] as const;
  private readonly stepsTitle = [
    'Plan Target',
    'Discover and Select Meals',
    'Finalize and Adjust Plan',
    'Shopping List',
  ];
  private readonly stepsSubTitle = [
    'Set the duration, targets, filters, and ingredient rules that shape this rotation.',
    'Review five suggestions at a time, keep the meals you want, and replace only what needs work.',
    'Adjust portions and frequency without wiping the rest of the plan.',
    'Review grouped ingredients, Walmart links, package counts, and the final cost.',
  ];

  currentIndex = 0;
  title = this.stepsTitle[0];
  subTitle = this.stepsSubTitle[0];
  heading = 'New Meal Prep';

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mealPlanFacade = inject(MealPlanFacade);
  private readonly recipesFacade = inject(RecipesFacade);
  readonly wizard = inject(MealPlanWizard);

  private readonly mealPlanError = toSignal(this.mealPlanFacade.error$, { initialValue: null });
  private readonly recipesError = toSignal(this.recipesFacade.error$, { initialValue: null });

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        const childPath = this.route.firstChild?.snapshot.routeConfig?.path ?? 'target';
        const index = this.steps.indexOf(childPath as (typeof this.steps)[number]);
        this.setStep(index >= 0 ? index : 0);
      });

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (Number.isFinite(id)) {
      this.heading = 'Edit Meal Prep';
      this.mealPlanFacade.getMealPlanDetail(id).subscribe(detail => this.wizard.hydrate(detail));
    }

    this.recipesFacade.loadIfNeeded();
  }

  ngOnDestroy(): void {
    this.wizard.reset();
  }

  get canGoBack(): boolean {
    return this.currentIndex > 0;
  }

  get canGoNext(): boolean {
    if (this.wizard.isRecalculating()) {
      return false;
    }

    switch (this.currentIndex) {
      case 0:
        return this.wizard.target.valid;
      case 1:
      case 2:
        return this.wizard.hasSelectedMeals();
      default:
        return false;
    }
  }

  get isLast(): boolean {
    return this.currentIndex === this.steps.length - 1;
  }

  get showNext(): boolean {
    return !this.isLast;
  }

  goBack(): void {
    if (!this.canGoBack) {
      return;
    }

    this.router.navigate([this.steps[this.currentIndex - 1]], { relativeTo: this.route });
  }

  goNext(): void {
    if (!this.canGoNext || this.isLast) {
      return;
    }

    if (this.currentIndex === 1 || this.currentIndex === 2) {
      this.recalculateThen(() => {
        this.router.navigate([this.steps[this.currentIndex + 1]], { relativeTo: this.route });
      });
      return;
    }

    this.router.navigate([this.steps[this.currentIndex + 1]], { relativeTo: this.route });
  }

  saveMealPlan(): void {
    if (!this.wizard.hasSelectedMeals() || this.wizard.isRecalculating()) {
      return;
    }

    this.recalculateThen(() => {
      this.mealPlanFacade
        .saveMealPlan(this.wizard.buildSaveRequest())
        .subscribe(mealPlan => {
          this.router.navigate(['/meal-plan', mealPlan.id]);
        });
    });
  }

  errorMessage(): string | null {
    return this.mealPlanError() ?? this.recipesError();
  }

  private recalculateThen(onSuccess: () => void): void {
    if (!this.wizard.hasPendingRecalculation()) {
      onSuccess();
      return;
    }

    this.wizard.recalculate(this.mealPlanFacade).subscribe(calculation => {
      if (calculation) {
        onSuccess();
      }
    });
  }

  private setStep(index: number): void {
    this.currentIndex = index;
    this.title = this.stepsTitle[index];
    this.subTitle = this.stepsSubTitle[index];
  }
}

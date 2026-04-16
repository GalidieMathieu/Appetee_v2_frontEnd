import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { MealPlanFacade } from '../meal-plan.facade';
import { MealPlanChangeState } from '../meal-plan.model';
import { MealPlanWizard } from '../meal-plan.wizard';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './step-preview.page.html',
  styleUrl: './step-preview.page.scss',
})
export class StepPreviewPageComponent implements OnInit {
  readonly wizard = inject(MealPlanWizard);

  private readonly mealPlanFacade = inject(MealPlanFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    if (this.wizard.hasSelectedMeals() && this.wizard.calculation() === null) {
      this.recalculate();
    }
  }

  mealGroupAt(index: number) {
    return this.wizard.selectedMeals.at(index);
  }

  recalculate(): void {
    this.wizard.recalculate(this.mealPlanFacade).subscribe();
  }

  goToReplacement(recipeId: number): void {
    this.wizard.beginReplacement(recipeId);
    this.router.navigate(['../recipes'], { relativeTo: this.route });
  }

  changeStateLabel(changeState: MealPlanChangeState): string {
    switch (changeState) {
      case 'kept':
        return 'Kept';
      case 'updated':
        return 'Updated';
      case 'needs-replacement':
        return 'Needs replacement';
    }
  }
}

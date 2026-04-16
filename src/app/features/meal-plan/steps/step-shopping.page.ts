import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';

import { MealPlanFacade } from '../meal-plan.facade';
import { MealPlanWizard } from '../meal-plan.wizard';

@Component({
  standalone: true,
  imports: [CommonModule],
  templateUrl: './step-shopping.page.html',
  styleUrl: './step-shopping.page.scss',
})
export class StepShoppingPageComponent implements OnInit {
  readonly wizard = inject(MealPlanWizard);

  private readonly mealPlanFacade = inject(MealPlanFacade);

  ngOnInit(): void {
    if (this.wizard.hasSelectedMeals() && this.wizard.calculation() === null) {
      this.wizard.recalculate(this.mealPlanFacade).subscribe();
    }
  }
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PlannerMealDto } from '@app/core/shared/data-access/meal-plan/meal-plan.model';
import { mealPlanWarningText } from '../models/meal-plan-display.model';
import { MatIconModule } from '@angular/material/icon';
import { NutritionSummaryComponent } from './nutrition-summary.component';
@Component({ selector: 'app-meal-row', standalone: true, imports: [MatIconModule, NutritionSummaryComponent], templateUrl: './meal-row.component.html', styleUrl: './meal-row.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class MealRowComponent {
    readonly warningText = mealPlanWarningText;
    readonly meal = input.required<PlannerMealDto>();
    readonly compact = input(false);
    readonly openMeal = output<PlannerMealDto>();
}

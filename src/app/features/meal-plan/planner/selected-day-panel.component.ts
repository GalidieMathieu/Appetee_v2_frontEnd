import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PlannerDayDto, PlannerMealDto } from '@app/core/shared/data-access/meal-plan/meal-plan.model';
import { MealRowComponent } from './meal-row.component';
import { NutritionSummaryComponent } from './nutrition-summary.component';
import { mealPlanWarningText } from '../models/meal-plan-display.model';
import { DatePipe } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
@Component({ selector: 'app-selected-day-panel', standalone: true, imports: [MealRowComponent, NutritionSummaryComponent, DatePipe, DragDropModule, MatIconModule], templateUrl: './selected-day-panel.component.html', styleUrl: './selected-day-panel.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class SelectedDayPanelComponent {
    readonly warningText = mealPlanWarningText;
    readonly day = input.required<PlannerDayDto>();
    readonly showTargets = input(false);
    readonly selectedKey = input<string | null>(null);
    readonly compact = input(false);
    readonly canAddMeal = input(false);
    readonly newMeal = output<void>();
    readonly actionsReady = input(false);
    readonly startOrder = output<void>();
    readonly cancelOrder = output<void>();
    readonly reorder = output<{ from: number; to: number }>();
    readonly copyDay = output<void>();
    readonly openMeal = output<PlannerMealDto>();
}

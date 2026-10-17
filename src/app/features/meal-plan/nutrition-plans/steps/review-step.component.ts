import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { NutritionTargetsComponent } from '../nutrition-targets.component';
import { NutritionCalculationDto } from '@app/core/shared/data-access/meal-plan/nutrition-plan.model';
import { NutritionPlanForm, NutritionPlanStep } from '../../models/nutrition-plan-draft.model';
import { mealPlanWarningText } from '../../models/meal-plan-display.model';
import { GOAL_OPTIONS, ACTIVITY_OPTIONS } from '../../forms/nutrition-plan-form.factory';
@Component({ selector: 'app-review-step', standalone: true, imports: [ReactiveFormsModule, DecimalPipe, MatIconModule, NutritionTargetsComponent], templateUrl: './review-step.component.html', styleUrl: './review-step.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class ReviewStepComponent {
    readonly warningText = mealPlanWarningText;
    readonly goalLabels = Object.fromEntries(GOAL_OPTIONS.map(option => [option.code, option.label]));
    readonly activityLabels = Object.fromEntries(ACTIVITY_OPTIONS.map(option => [option.code, option.label]));
    readonly nameError = input<string | null>(null);
    readonly form = input.required<NutritionPlanForm>();
    readonly preview = input<NutritionCalculationDto | null>(null);
    readonly pending = input(false);
    readonly error = input<string | null>(null);
    readonly showName = input(true);
    readonly allowChange = input(true);
    readonly summaryOnly = input(false);
    readonly stepRequested = output<NutritionPlanStep>();
    readonly changeSteps: readonly NutritionPlanStep[] = ['profile', 'goal', 'activity', 'meal-structure'];
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NutritionPlanForm } from '../../models/nutrition-plan-draft.model';
@Component({ selector: 'app-meal-structure-step', standalone: true, imports: [ReactiveFormsModule], templateUrl: './meal-structure-step.component.html', styleUrl: './meal-structure-step.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class MealStructureStepComponent {
    readonly form = input.required<NutritionPlanForm>();
    readonly error = input<string | null>(null);
    readonly compact = input(false);
    readonly counts = [1, 2, 3, 4, 5, 6, 7, 8];
}

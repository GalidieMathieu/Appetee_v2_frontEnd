import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { createCalculationChoiceForm, GOAL_OPTIONS } from '../../forms/nutrition-plan-form.factory';
@Component({ selector: 'app-goal-step', standalone: true, imports: [ReactiveFormsModule, MatIconModule], templateUrl: './goal-step.component.html', styleUrl: './goal-step.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class GoalStepComponent {
    readonly form = input.required<ReturnType<typeof createCalculationChoiceForm>>();
    readonly options = GOAL_OPTIONS;
    readonly error = input<string | null>(null);
    readonly compact = input(false);
    readonly presentation = {
        performance: { icon: 'directions_run', description: 'Support energy, training and recovery.' },
        maintain: { icon: 'balance', description: 'Support your current weight with balanced nutrition.' },
        fatLoss: { icon: 'south', description: 'Reduce body fat while preserving muscle.' },
        muscleGain: { icon: 'fitness_center', description: 'Support muscle growth with limited fat gain.' },
        weightGain: { icon: 'north', description: 'Support a sustainable increase in body weight.' },
        recomposition: { icon: 'track_changes', description: 'Build muscle and reduce body fat.' },
    };
}

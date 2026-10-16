import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { createCalculationChoiceForm, ACTIVITY_OPTIONS } from '../../forms/nutrition-plan-form.factory';
@Component({ selector: 'app-activity-step', standalone: true, imports: [ReactiveFormsModule, MatIconModule], templateUrl: './activity-step.component.html', styleUrl: './activity-step.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class ActivityStepComponent {
    readonly form = input.required<ReturnType<typeof createCalculationChoiceForm>>();
    readonly options = ACTIVITY_OPTIONS;
    readonly error = input<string | null>(null);
    readonly compact = input(false);
    readonly icons = { inactive: 'weekend', lowActive: 'directions_walk', active: 'directions_run', veryActive: 'fitness_center' };
}

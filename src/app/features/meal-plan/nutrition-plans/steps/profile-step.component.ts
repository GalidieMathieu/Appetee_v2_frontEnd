import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NutritionProfileFormComponent } from '@app/core/shared/ui/nutrition-profile-form/nutrition-profile-form.component';
import { NutritionProfileFormGroup, NutritionProfileFieldErrors } from '@app/core/shared/ui/nutrition-profile-form/nutrition-profile-form.model';
@Component({ selector: 'app-profile-step', standalone: true, imports: [ReactiveFormsModule, NutritionProfileFormComponent, MatIconModule], templateUrl: './profile-step.component.html', styleUrl: './profile-step.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class ProfileStepComponent {
    readonly form = input.required<NutritionProfileFormGroup>();
    readonly errors = input<NutritionProfileFieldErrors>({});
    readonly compact = input(false);
}

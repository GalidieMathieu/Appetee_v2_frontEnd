import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import {
  NutritionProfileFieldErrors,
  NutritionProfileFormGroup,
} from './nutrition-profile-form.model';

@Component({
  selector: 'app-nutrition-profile-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './nutrition-profile-form.component.html',
  styleUrl: './nutrition-profile-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.plan-context]': 'planContext()', '[class.compact]': 'compact()' },
})
export class NutritionProfileFormComponent {
  readonly form = input.required<NutritionProfileFormGroup>();
  readonly planContext = input(false);
  readonly compact = input(false);
  readonly pending = input(false);
  readonly blocked = input(false);
  readonly diagnostic = input<string | null>(null);
  readonly errorMessage = input<string | null>(null);
  readonly successMessage = input<string | null>(null);
  readonly fieldErrors = input<NutritionProfileFieldErrors>({});
  readonly save = output<void>();

  submit(): void {
    this.save.emit();
  }

  describedBy(control: keyof NutritionProfileFieldErrors, localErrorId: string): string | null {
    const field = this.form().controls[control];
    const showLocal = control === 'adultConfirmed'
      ? this.form().touched && this.form().hasError('adultConfirmationRequired')
      : field.touched && field.invalid;
    const ids = localErrorId.split(' ').filter(id => !id.endsWith('-error') || showLocal);
    const errors = this.fieldErrors()[control];
    if (errors?.length) ids.push(`${control}-server-error`);
    return ids.join(' ') || null;
  }

  invalid(control: keyof NutritionProfileFieldErrors): boolean {
    return !!this.fieldErrors()[control]?.length
      || (control === 'adultConfirmed'
        ? this.form().touched && this.form().hasError('adultConfirmationRequired')
        : this.form().controls[control].touched && this.form().controls[control].invalid);
  }

  errorLinks(): { id: string; message: string }[] {
    const local: Record<keyof NutritionProfileFieldErrors, { id: string; message: string }> = {
      calculationSex: { id: 'nutrition-sex-female', message: 'Choose a calculation sex.' },
      ageYears: { id: 'nutrition-age', message: 'Enter a whole-number age from 18 to 65.' },
      heightCm: { id: 'nutrition-height', message: 'Enter 120–230 cm with up to two decimals.' },
      weightKg: { id: 'nutrition-weight', message: 'Enter 35–250 kg with up to two decimals.' },
      adultConfirmed: { id: 'nutrition-adult', message: 'Adult confirmation is required at age 18.' },
    };
    return (Object.keys(local) as (keyof NutritionProfileFieldErrors)[])
      .filter(control => this.invalid(control))
      .map(control => ({ ...local[control], message: this.fieldErrors()[control]?.[0] ?? local[control].message }));
  }
}

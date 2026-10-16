import { FormControl, FormGroup } from '@angular/forms';

import { CalculationSex } from '../../data-access/user/nutrition-profile.model';

export interface NutritionProfileFormControls {
  readonly calculationSex: FormControl<CalculationSex | null>;
  readonly ageYears: FormControl<number | null>;
  readonly heightCm: FormControl<number | null>;
  readonly weightKg: FormControl<number | null>;
  readonly adultConfirmed: FormControl<boolean>;
}

export type NutritionProfileFormGroup = FormGroup<NutritionProfileFormControls>;

export type NutritionProfileFieldErrors = Readonly<
  Partial<Record<keyof NutritionProfileFormControls, readonly string[]>>
>;

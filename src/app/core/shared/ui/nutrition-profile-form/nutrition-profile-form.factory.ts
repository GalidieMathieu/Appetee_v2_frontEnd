import { AbstractControl, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';

import {
  NutritionProfileRequest,
  NutritionProfileValue,
} from '../../data-access/user/nutrition-profile.model';
import { NutritionProfileFormGroup } from './nutrition-profile-form.model';

export const MIN_PROFILE_AGE = 18;
export const MAX_PROFILE_AGE = 65;

export function createNutritionProfileForm(
  profile: NutritionProfileValue | null = null,
  calculationYear = new Date().getUTCFullYear()
): NutritionProfileFormGroup {
  const ageYears = profile === null ? null : calculationYear - profile.birthYear;
  return new FormGroup({
    calculationSex: new FormControl(profile?.calculationSex ?? null, {
      validators: [Validators.required, calculationSexValidator],
    }),
    ageYears: new FormControl(ageYears, {
      validators: [Validators.required, Validators.min(MIN_PROFILE_AGE), Validators.max(MAX_PROFILE_AGE), integerValidator],
    }),
    heightCm: new FormControl(profile?.heightCm ?? null, {
      validators: [Validators.required, Validators.min(120), Validators.max(230), maximumTwoDecimalsValidator],
    }),
    weightKg: new FormControl(profile?.weightKg ?? null, {
      validators: [Validators.required, Validators.min(35), Validators.max(250), maximumTwoDecimalsValidator],
    }),
    adultConfirmed: new FormControl(false, { nonNullable: true }),
  }, { validators: adultConfirmationValidator });
}

export function nutritionProfileRequestFromForm(
  form: NutritionProfileFormGroup,
  calculationYear = new Date().getUTCFullYear()
): NutritionProfileRequest | null {
  if (form.invalid) return null;
  const value = form.getRawValue();
  if (value.calculationSex === null
    || value.ageYears === null
    || value.heightCm === null
    || value.weightKg === null) return null;

  return {
    calculationSex: value.calculationSex,
    birthYear: calculationYear - value.ageYears,
    heightCm: value.heightCm,
    weightKg: value.weightKg,
    ...(value.ageYears === MIN_PROFILE_AGE ? { adultConfirmed: true } : {}),
  };
}

export function profileToFormValue(
  profile: NutritionProfileValue | null,
  calculationYear = new Date().getUTCFullYear()
): ReturnType<NutritionProfileFormGroup['getRawValue']> {
  return {
    calculationSex: profile?.calculationSex ?? null,
    ageYears: profile === null ? null : calculationYear - profile.birthYear,
    heightCm: profile?.heightCm ?? null,
    weightKg: profile?.weightKg ?? null,
    adultConfirmed: false,
  };
}

function integerValidator(control: AbstractControl<number | null>): ValidationErrors | null {
  return control.value === null || Number.isInteger(control.value) ? null : { integer: true };
}

function maximumTwoDecimalsValidator(
  control: AbstractControl<number | null>
): ValidationErrors | null {
  if (control.value === null) return null;
  if (!Number.isFinite(control.value)) return { maximumTwoDecimals: true };
  // Decimal inputs such as 120.02 are not always exact in binary floating point.
  const scaled = control.value * 100;
  return Math.abs(scaled - Math.round(scaled)) <= Number.EPSILON * Math.abs(scaled)
    ? null : { maximumTwoDecimals: true };
}

function calculationSexValidator(control: AbstractControl): ValidationErrors | null {
  return control.value === null || control.value === 'male' || control.value === 'female'
    ? null : { calculationSex: true };
}

function adultConfirmationValidator(control: AbstractControl): ValidationErrors | null {
  const group = control as NutritionProfileFormGroup;
  return group.controls.ageYears.value === MIN_PROFILE_AGE
    && group.controls.adultConfirmed.value !== true
    ? { adultConfirmationRequired: true }
    : null;
}

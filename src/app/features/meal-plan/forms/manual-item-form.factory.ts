import { FormControl, FormGroup, ValidatorFn } from '@angular/forms';
const name: ValidatorFn = control => {
  const raw = String(control.value ?? ''), value = raw.trim().normalize('NFC');
  return Array.from(value).length >= 1 && Array.from(value).length <= 120 && !/[\p{Cc}\p{Cs}\u2028\u2029]/u.test(raw)
    ? null : { manual: 'Enter 1–120 characters without line or control characters.' };
};
export function manualNumber(max: number): ValidatorFn {
  return control => {
    const text = String(control.value ?? '').trim(), value = Number(text);
    return /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(text) && Number.isFinite(value) && value >= .01 && value <= max
      ? null : { manual: `Enter a number from 0.01 to ${max}, with at most 2 decimal places.` };
  };
}
export function createManualItemForm() {
  const numeric = (max: number) => new FormControl('', { nonNullable: true, validators: [manualNumber(max)] });
  return new FormGroup({ name: new FormControl('', { nonNullable: true, validators: [name] }),
    caloriesKcal: numeric(20000), proteinG: numeric(5000), carbsG: numeric(5000), fatG: numeric(5000) });
}
export type ManualItemForm = ReturnType<typeof createManualItemForm>;

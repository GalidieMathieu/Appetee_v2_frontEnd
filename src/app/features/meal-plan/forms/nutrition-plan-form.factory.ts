import { AbstractControl, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { CreateEasyNutritionPlanRequest } from '@app/core/shared/data-access/meal-plan/nutrition-plan.model';
import { NutritionPlanForm } from '../models/nutrition-plan-draft.model';
import { ActivityLevel, NutritionGoal } from '@app/core/shared/data-access/meal-plan/nutrition-plan.model';
export const GOAL_OPTIONS: readonly {
    code: NutritionGoal;
    label: string;
}[] = [
    { code: 'performance', label: 'Fuel my training / perform better' }, { code: 'maintain', label: 'Maintain current weight' },
    { code: 'fatLoss', label: 'Lose body fat while keeping muscle' }, { code: 'muscleGain', label: 'Gain muscle while limiting fat gain' },
    { code: 'weightGain', label: 'Gain body weight' }, { code: 'recomposition', label: 'Improve body composition' },
];
export const ACTIVITY_OPTIONS: readonly {
    code: ActivityLevel;
    label: string;
    description: string;
}[] = [
    { code: 'inactive', label: 'Inactive', description: 'Mostly seated daily routine, little structured exercise.' },
    { code: 'lowActive', label: 'Low active', description: 'Some daily movement and light or occasional training.' },
    { code: 'active', label: 'Active', description: 'Regular training combined with a moderately active routine.' },
    { code: 'veryActive', label: 'Very active', description: 'High training volume and/or a physically demanding daily routine.' },
];
export function createCalculationChoiceForm() {
    return new FormGroup({
        goal: new FormControl<NutritionGoal | null>(null, [Validators.required, enumValidator(GOAL_OPTIONS.map(x => x.code))]),
        activityLevel: new FormControl<ActivityLevel | null>(null, [Validators.required, enumValidator(ACTIVITY_OPTIONS.map(x => x.code))]),
    });
}
function enumValidator(values: readonly string[]) {
    return (control: AbstractControl): ValidationErrors | null => control.value === null || values.includes(control.value) ? null : { enum: true };
}
export function createNutritionPlanForm(): NutritionPlanForm {
    return new FormGroup({
        name: new FormControl('', { nonNullable: true, validators: [planNameValidator] }),
        defaultMealsPerDay: new FormControl<number | null>(null, {
            validators: [Validators.required, Validators.min(1), Validators.max(8), integerValidator],
        }),
    });
}
export function easyRequestFromForm(form: NutritionPlanForm): CreateEasyNutritionPlanRequest | null {
    if (!form.valid)
        return null;
    const { name, defaultMealsPerDay } = form.getRawValue();
    if (defaultMealsPerDay === null)
        return null;
    return { name: name.trim().normalize('NFC'), mode: 'easy', defaultMealsPerDay };
}
function planNameValidator(control: AbstractControl<string>): ValidationErrors | null {
    const normalized = control.value.trim().normalize('NFC');
    if (!normalized)
        return { required: true };
    if (Array.from(normalized).length > 80)
        return { nameLength: true };
    // Unicode scalars exclude lone surrogates; reject control and line characters, never strip them.
    if (/[\p{Cc}\p{Cs}\u2028\u2029]/u.test(control.value))
        return { nameCharacters: true };
    return null;
}
function integerValidator(control: AbstractControl<number | null>): ValidationErrors | null {
    return control.value === null || Number.isInteger(control.value) ? null : { integer: true };
}

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';

import {
  createNutritionProfileForm,
  nutritionProfileRequestFromForm,
} from './nutrition-profile-form.factory';
import { NutritionProfileFormComponent } from './nutrition-profile-form.component';
import { NutritionProfileFormGroup } from './nutrition-profile-form.model';

describe('NutritionProfileFormComponent', () => {
  let fixture: ComponentFixture<NutritionProfileFormComponent>;
  let form: NutritionProfileFormGroup;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NutritionProfileFormComponent] })
      .compileComponents();
    form = createNutritionProfileForm(null, 2026);
    fixture = TestBed.createComponent(NutritionProfileFormComponent);
    fixture.componentRef.setInput('form', form);
    fixture.detectChanges();
  });

  it('starts empty and exposes accessible metric labels and purpose copy', () => {
    expect(form.invalid).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Age this year');
    expect(fixture.nativeElement.textContent).toContain('Height (cm)');
    expect(fixture.nativeElement.textContent).toContain('Weight (kg)');
    expect(fixture.nativeElement.textContent).toContain('does not recalculate existing plans');
    expect(fixture.nativeElement.querySelector('#nutrition-age')).not.toBeNull();
  });

  it('accepts inclusive boundaries and at most two decimal places', () => {
    form.setValue({
      calculationSex: 'male',
      ageYears: 65,
      heightCm: 120.01,
      weightKg: 249.99,
      adultConfirmed: false,
    });
    expect(form.valid).toBe(true);
    expect(nutritionProfileRequestFromForm(form, 2026)).toEqual({
      calculationSex: 'male',
      birthYear: 1961,
      heightCm: 120.01,
      weightKg: 249.99,
    });

    form.controls.weightKg.setValue(64.123);
    expect(form.controls.weightKg.hasError('maximumTwoDecimals')).toBe(true);
  });

  it('requires explicit adult confirmation when age this year is 18', () => {
    form.setValue({
      calculationSex: 'female',
      ageYears: 18,
      heightCm: 168,
      weightKg: 64,
      adultConfirmed: false,
    });
    form.markAllAsTouched();
    fixture.detectChanges();

    expect(form.hasError('adultConfirmationRequired')).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('I confirm that I am already 18');
    form.controls.adultConfirmed.setValue(true);
    expect(nutritionProfileRequestFromForm(form, 2026)?.adultConfirmed).toBe(true);
  });

  it('links visible validation feedback and emits intent without owning persistence', () => {
    const save = vi.fn();
    fixture.componentInstance.save.subscribe(save);
    form.controls.ageYears.markAsTouched();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#nutrition-age') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain('nutrition-age-error');
    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('shows server errors as plain summary text and associates them with the field', () => {
    form.setValue({ calculationSex: 'female', ageYears: 30, heightCm: 168, weightKg: 64,
      adultConfirmed: false });
    fixture.componentRef.setInput('fieldErrors', { ageYears: ['Review your age.'] });
    fixture.componentRef.setInput('errorMessage', 'Validation failed.');
    fixture.componentRef.setInput('diagnostic', 'validation_failed · test-trace');
    fixture.detectChanges();
    const age = fixture.nativeElement.querySelector('#nutrition-age');
    expect(age.getAttribute('aria-invalid')).toBe('true');
    expect(age.getAttribute('aria-describedby')).toContain('ageYears-server-error');
    expect(age.getAttribute('aria-describedby')).not.toContain('nutrition-age-error');
    expect(fixture.nativeElement.querySelector('.nutrition-profile__summary').textContent)
      .toContain('Review your age.');
    expect(fixture.nativeElement.querySelector('.nutrition-profile__summary a')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('test-trace');
  });

  it('renders the plan height error as plain text while retaining accessible inline feedback', () => {
    fixture.componentRef.setInput('planContext', true);
    form.controls.heightCm.setValue(119);
    form.controls.heightCm.markAsTouched();
    fixture.detectChanges();

    const summary = fixture.nativeElement.querySelector('.nutrition-profile__summary');
    expect(summary.textContent).toContain('Review the calculation profile.');
    expect(summary.textContent).toContain('Enter 120–230 cm with up to two decimals.');
    expect(summary.querySelector('a')).toBeNull();
    const height = fixture.nativeElement.querySelector('#nutrition-height');
    expect(height.getAttribute('aria-invalid')).toBe('true');
    expect(height.getAttribute('aria-describedby')).toContain('nutrition-height-error');
  });

  it('accepts binary-inexact two-decimal values and rejects non-finite numbers and unknown enums', () => {
    form.setValue({ calculationSex: 'male', ageYears: 30, heightCm: 120.02, weightKg: 64.01,
      adultConfirmed: false });
    expect(form.valid).toBe(true);
    for (const value of [NaN, Infinity, -Infinity, 120.021]) {
      form.controls.heightCm.setValue(value);
      expect(form.invalid).toBe(true);
    }
    form.controls.heightCm.setValue(120.02);
    form.controls.calculationSex.setValue('unknown' as 'male');
    expect(form.invalid).toBe(true);
  });
});

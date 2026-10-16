import { TestBed } from '@angular/core/testing';
import { GoalStepComponent } from './goal-step.component';
import { ActivityStepComponent } from './activity-step.component';
import { MealStructureStepComponent } from './meal-structure-step.component';
import { createCalculationChoiceForm, createNutritionPlanForm } from '../../forms/nutrition-plan-form.factory';

describe('Reference-aligned edit selectors', () => {
  it('shares the goal control and preserves field-error anchor and feedback in compact editing', () => {
    const fixture = TestBed.createComponent(GoalStepComponent), form = createCalculationChoiceForm();
    form.controls.goal.setValue('maintain');
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('compact', true);
    fixture.componentRef.setInput('error', 'Review this goal.');
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('#goal-performance') as HTMLSelectElement;
    expect(select.options).toHaveLength(7);
    select.value = 'fatLoss'; select.dispatchEvent(new Event('change')); fixture.detectChanges();
    expect(form.controls.goal.value).toBe('fatLoss');
    expect(select.getAttribute('aria-describedby')).toBe('goal-feedback');
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('input[type=radio]')).toHaveLength(0);
  });
  it('keeps the four activity policy values in the edit selector', () => {
    const fixture = TestBed.createComponent(ActivityStepComponent), form = createCalculationChoiceForm();
    fixture.componentRef.setInput('form', form); fixture.componentRef.setInput('compact', true); fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('#activity-inactive') as HTMLSelectElement;
    select.value = 'veryActive'; select.dispatchEvent(new Event('change')); fixture.detectChanges();
    expect(form.controls.activityLevel.value).toBe('veryActive');
    expect(select.options).toHaveLength(5);
  });
  it('keeps all eight meal counts as numeric values in compact editing', () => {
    const fixture = TestBed.createComponent(MealStructureStepComponent), form = createNutritionPlanForm();
    fixture.componentRef.setInput('form', form); fixture.componentRef.setInput('compact', true); fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('#meal-count-1') as HTMLSelectElement;
    select.selectedIndex = 8; select.dispatchEvent(new Event('change')); fixture.detectChanges();
    expect(form.controls.defaultMealsPerDay.value).toBe(8);
    expect(select.options).toHaveLength(9);
  });
});

import { AbstractControl } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IngredientCreateFormComponent } from './ingredient-creation.component';

describe('IngredientCreateFormComponent calculation fields', () => {
  let fixture: ComponentFixture<IngredientCreateFormComponent>;
  let component: IngredientCreateFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IngredientCreateFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IngredientCreateFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('requires price, protein, and carbs', () => {
    setControlValue(component.form.controls.price, null);
    setControlValue(component.form.controls.proteinG, null);
    setControlValue(component.form.controls.carbsG, null);

    expect(component.form.controls.price.hasError('required')).toBe(true);
    expect(component.form.controls.proteinG.hasError('required')).toBe(true);
    expect(component.form.controls.carbsG.hasError('required')).toBe(true);
    expect(component.buildCreateRequest()).toBeNull();

    fixture.detectChanges();
    const priceInput = fixture.nativeElement.querySelector('#price') as HTMLInputElement;
    expect(priceInput.getAttribute('aria-invalid')).toBe('true');
    expect(priceInput.getAttribute('aria-describedby')).toBe('price-error');
    expect(fixture.nativeElement.textContent).toContain(
      'Price is required and cannot be negative.'
    );
  });

  it('accepts zero calculation values and includes them in the request', () => {
    completeRequiredFields();

    const request = component.buildCreateRequest();

    expect(request).toEqual(expect.objectContaining({
      caloriesKcal: 0,
      price: 0,
      proteinG: 0,
      carbsG: 0,
    }));
  });

  it.each(['caloriesKcal', 'price', 'proteinG', 'carbsG'] as const)(
    'rejects a negative %s value',
    field => {
      completeRequiredFields();
      component.form.controls[field].setValue(-1);

      expect(component.form.controls[field].hasError('min')).toBe(true);
      expect(component.buildCreateRequest()).toBeNull();
    }
  );

  function completeRequiredFields(): void {
    component.form.patchValue({
      name: 'Carrot',
      caloriesKcal: 0,
      price: 0,
      proteinG: 0,
      carbsG: 0,
    });
    component.form.controls.image.setValue(
      new File(['image'], 'carrot.avif', { type: 'image/avif' })
    );
  }
});

function setControlValue(control: AbstractControl, value: null): void {
  control.setValue(value);
}

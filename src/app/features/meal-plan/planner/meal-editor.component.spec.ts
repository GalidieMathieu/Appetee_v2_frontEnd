import { TestBed } from '@angular/core/testing';
import { MealEditorComponent } from './meal-editor.component';
import { plannerRange } from '@app/core/shared/data-access/meal-plan/testing/meal-plan.fixtures';
describe('MealEditorComponent', () => {
  it('offers removal of unavailable recipes, never coerces unknown fat or enables quantity editing', () => {
    const fixture = TestBed.createComponent(MealEditorComponent), meal = plannerRange('2026-10-12').days[0]!.meals[0]!;
    fixture.componentRef.setInput('meal', { ...meal, items: [{ ...meal.items[0], availability: 'unavailable', name: null }] });
    fixture.componentRef.setInput('name', meal.name); fixture.componentRef.setInput('scalarReady', true); fixture.componentRef.setInput('actionsReady', true); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#quantity-30').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[aria-label="Remove unavailable recipe"]').disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('[aria-label^="Unknown"]')).not.toBeNull();
  });
});

import { TestBed } from '@angular/core/testing';
import { NutritionTargetsComponent } from './nutrition-targets.component';

describe('NutritionTargetsComponent', () => {
  it('displays exact server values and unknowns without invented percentages', () => {
    const fixture = TestBed.createComponent(NutritionTargetsComponent);
    fixture.componentRef.setInput('targets', { caloriesKcal: 1900, proteinG: 115, carbsG: 214, fatG: null });
    fixture.componentRef.setInput('sidebar', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('1,900 kcal');
    expect(fixture.nativeElement.textContent).toContain('115 g');
    expect(fixture.nativeElement.querySelector('[aria-label="Unknown"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('%');
    expect(fixture.nativeElement.querySelectorAll('.target__ring[aria-hidden="true"]')).toHaveLength(4);
  });
});

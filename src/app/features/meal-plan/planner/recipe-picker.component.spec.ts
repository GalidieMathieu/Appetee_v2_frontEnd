import { TestBed } from '@angular/core/testing';
import { RecipePickerComponent } from './recipe-picker.component';
describe('RecipePickerComponent', () => {
  it('does not claim empty before loading and offers only working Search/Saved sources', () => {
    const fixture = TestBed.createComponent(RecipePickerComponent); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('No recipes match');
    fixture.componentRef.setInput('loaded', true); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No recipes match');
    expect(fixture.nativeElement.textContent).not.toContain('Recommended'); expect(fixture.nativeElement.textContent).not.toContain('Recent');
  });
});

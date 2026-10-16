import { TestBed } from '@angular/core/testing';
import { RecipePickerRowComponent } from './recipe-picker-row.component';
describe('RecipePickerRowComponent', () => {
  it('labels In meal, unknown fat and lazy preview without changing favorite membership', () => {
    const fixture = TestBed.createComponent(RecipePickerRowComponent);
    fixture.componentRef.setInput('recipe', { id: 1, name: 'Soup', description: 'Vegetable soup', cardImageUrl: null, caloriesPerServing: 100, proteinPerServing: 10, carbsPerServing: 20, fatPerServing: null, totalTimeMinutes: 20, badges: [], isSaved: true });
    fixture.componentRef.setInput('inMeal', true); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Soup is in this meal"]').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[aria-label=Unknown]')).not.toBeNull();
  });
});

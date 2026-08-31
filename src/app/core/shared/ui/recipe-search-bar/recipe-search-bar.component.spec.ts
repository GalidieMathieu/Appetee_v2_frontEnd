/** Shared recipe search tests protect normalized submission and externally controlled current value. */
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { RecipeSearchBarComponent } from './recipe-search-bar.component';

describe('RecipeSearchBarComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RecipeSearchBarComponent] });
  });

  it('emits a normalized value through the semantic Enter/form submission path', () => {
    const fixture = createFixture();
    const submitted = vi.fn();
    fixture.componentInstance.searchSubmitted.subscribe(submitted);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '  rice   chicken  ';
    input.dispatchEvent(new Event('input'));

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(submitted).toHaveBeenCalledWith('rice chicken');
  });

  it('emits when the Search submit button is clicked', () => {
    const fixture = createFixture();
    const submitted = vi.fn();
    fixture.componentInstance.searchSubmitted.subscribe(submitted);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'soup';
    input.dispatchEvent(new Event('input'));

    (fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).click();

    expect(submitted).toHaveBeenCalledWith('soup');
  });

  it('reflects a provided current value and later input changes', () => {
    const fixture = TestBed.createComponent(RecipeSearchBarComponent);
    fixture.componentRef.setInput('value', 'rice chicken');
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('rice chicken');

    fixture.componentRef.setInput('value', 'tomato soup');
    fixture.detectChanges();

    expect(input.value).toBe('tomato soup');
  });

  it('contains no routing or HTTP provider dependency', () => {
    const fixture = createFixture();
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.querySelector('form[role="search"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('label')?.textContent).toContain('Search recipes');
  });
});

function createFixture() {
  const fixture = TestBed.createComponent(RecipeSearchBarComponent);
  fixture.detectChanges();
  return fixture;
}

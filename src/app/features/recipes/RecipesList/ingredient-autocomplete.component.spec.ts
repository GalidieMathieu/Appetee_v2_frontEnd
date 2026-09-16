/**
 * Ingredient autocomplete tests cover request thresholds, debounce/stale safety, bounded results,
 * independent selection identity, and keyboard-accessible combobox behavior.
 */
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { IngredientsApi } from '@app/core/shared/data-access/ingredients/ingredient.api';
import { Ingredient } from '@app/core/shared/data-access/ingredients/ingredient.model';

import { IngredientAutocompleteComponent } from './ingredient-autocomplete.component';

describe('IngredientAutocompleteComponent', () => {
  const search = vi.fn();

  beforeEach(async () => {
    search.mockReset();
    await TestBed.configureTestingModule({
      imports: [IngredientAutocompleteComponent],
      providers: [{ provide: IngredientsApi, useValue: { search } }],
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  it('does not request before two trimmed characters', async () => {
    vi.useFakeTimers();
    search.mockReturnValue(of([]));
    const fixture = createFixture();

    typeQuery(fixture, ' c ');
    await vi.advanceTimersByTimeAsync(350);

    expect(search).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeNull();
  });

  it('debounces query changes into one bounded request', async () => {
    vi.useFakeTimers();
    search.mockReturnValue(of([]));
    const fixture = createFixture();

    typeQuery(fixture, 'ch');
    await vi.advanceTimersByTimeAsync(200);
    typeQuery(fixture, 'chic');
    await vi.advanceTimersByTimeAsync(299);
    expect(search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(search).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalledWith('chic', 10);
  });

  it('ignores an older response and renders no more than ten suggestions', async () => {
    vi.useFakeTimers();
    const older = new Subject<Ingredient[]>();
    const newer = new Subject<Ingredient[]>();
    search.mockReturnValueOnce(older).mockReturnValueOnce(newer);
    const fixture = createFixture();

    typeQuery(fixture, 'ch');
    await vi.advanceTimersByTimeAsync(300);
    typeQuery(fixture, 'chi');
    await vi.advanceTimersByTimeAsync(300);
    newer.next(Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      name: `New ${index + 1}`,
    })));
    fixture.detectChanges();
    older.next([{ id: 99, name: 'Old result' }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[role="option"]')).toHaveLength(10);
    expect(fixture.nativeElement.textContent).toContain('New 1');
    expect(fixture.nativeElement.textContent).not.toContain('Old result');
  });

  it('selects with ArrowDown and Enter while preserving existing selected identity', async () => {
    vi.useFakeTimers();
    const chicken = { id: 1, name: 'Chicken' };
    const tomato = { id: 2, name: 'Tomato' };
    search.mockReturnValue(of([tomato]));
    const fixture = createFixture([chicken]);
    const selected = vi.fn();
    fixture.componentInstance.selectedIngredientsChange.subscribe(selected);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    typeQuery(fixture, 'to');
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(selected).toHaveBeenCalledWith([chicken, tomato]);
    expect(fixture.nativeElement.textContent).toContain('Chicken');
    expect(input.value).toBe('');
  });

  it('locks searching at three selections and unlocks through an accessible removal', async () => {
    vi.useFakeTimers();
    const fixture = createFixture([
      { id: 1, name: 'Chicken' },
      { id: 2, name: 'Tomato' },
      { id: 3, name: 'Rice' },
    ]);
    const selected = vi.fn();
    fixture.componentInstance.selectedIngredientsChange.subscribe(selected);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    expect(input.readOnly).toBe(true);
    expect(input.getAttribute('aria-describedby')).toBe('ingredient-selection-limit');
    (fixture.nativeElement.querySelector('[aria-label="Remove Chicken"]') as HTMLButtonElement)
      .click();

    expect(selected).toHaveBeenCalledWith([
      { id: 2, name: 'Tomato' },
      { id: 3, name: 'Rice' },
    ]);
  });

  it('shows a retryable local error without replacing selected ingredients', async () => {
    vi.useFakeTimers();
    search.mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of([{ id: 2, name: 'Tomato' }]));
    const fixture = createFixture([{ id: 1, name: 'Chicken' }]);

    typeQuery(fixture, 'to');
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ingredients could not be loaded');
    (fixture.nativeElement.querySelector('.ingredient-autocomplete__status button') as HTMLButtonElement)
      .click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    expect(search).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Tomato');
    expect(fixture.nativeElement.textContent).toContain('Chicken');
  });
});

function createFixture(selected: readonly Ingredient[] = []) {
  const fixture = TestBed.createComponent(IngredientAutocompleteComponent);
  fixture.componentRef.setInput('selectedIngredients', selected);
  fixture.detectChanges();
  return fixture;
}

function typeQuery(
  fixture: ReturnType<typeof createFixture>,
  value: string
): void {
  const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges();
}

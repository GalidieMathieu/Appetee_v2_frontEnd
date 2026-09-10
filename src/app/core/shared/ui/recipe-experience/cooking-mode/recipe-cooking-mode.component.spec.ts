/**
 * Cooking Mode tests protect immutable scaling, compact instruction/progress content, timer layout,
 * session controls, accessibility, and time without HTTP or feature-page state.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { RecipeCookingViewDto } from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipeCookingModeComponent } from './recipe-cooking-mode.component';

describe('RecipeCookingModeComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders immutable base totals and authored content in explicit order', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(text(root, '[data-testid="selected-servings"]')).toBe('4 servings');
    expect(text(root, '[data-testid="scaled-calories"]')).toBe('800 cal');
    expect(text(root, '[data-testid="scaled-protein"]')).toBe('40 g');
    expect(text(root, '[data-testid="scaled-carbs"]')).toBe('100 g');
    expect(text(root, '[data-testid="total-time"]')).toBe('35 min');
    expect(Array.from(root.querySelectorAll('.cooking-ingredients__name'))
      .map(element => element.textContent?.trim())).toEqual(['Rice', 'Chicken', 'Seasoning']);
    const activeInstruction = root.querySelector('.cooking-step__instruction');
    const progressCopy = root.querySelector('.cooking-progress__copy');
    expect(activeInstruction?.textContent).toContain('Measure and season everything.');
    expect(activeInstruction?.textContent).not.toContain('Prepare ingredients');
    expect(activeInstruction?.querySelector('p')?.classList).toContain('text-body');
    expect(progressCopy?.textContent).toContain('Prepare ingredients');
    expect(progressCopy?.textContent).not.toContain('Measure and season everything.');
    expect(progressCopy?.querySelector('strong')?.classList).toContain('text-body-strong');
    expect(root.querySelector('.cooking-step + .cooking-timer')).not.toBeNull();
  });

  it('scales every quantity from base values and restores exact base display', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    click(root, '[aria-label="Increase servings"]');
    click(root, '[aria-label="Increase servings"]');
    fixture.detectChanges();

    expect(text(root, '[data-testid="selected-servings"]')).toBe('6 servings');
    expect(text(root, '[data-testid="scaled-calories"]')).toBe('1200 cal');
    expect(text(root, '[data-testid="scaled-protein"]')).toBe('60 g');
    expect(text(root, '[data-testid="scaled-carbs"]')).toBe('150 g');
    expect(text(root, '[data-ingredient-id="7"]')).toBe('300 g');
    expect(text(root, '[data-ingredient-id="8"]')).toBe('600 g');
    expect(text(root, '[data-ingredient-id="9"]')).toBe('1.88 tsp');
    expect(text(root, '[data-testid="total-time"]')).toBe('35 min');

    click(root, '[aria-label="Decrease servings"]');
    click(root, '[aria-label="Decrease servings"]');
    fixture.detectChanges();

    expect(text(root, '[data-testid="scaled-calories"]')).toBe('800 cal');
    expect(text(root, '[data-ingredient-id="8"]')).toBe('400 g');
    expect(text(root, '[data-ingredient-id="9"]')).toBe('1.25 tsp');
  });

  it('keeps serving selection within positive whole-number UI bounds', () => {
    const fixture = createFixture({ ...cookingView(), baseServings: 1 });
    const root = fixture.nativeElement as HTMLElement;
    const decrease = root.querySelector<HTMLButtonElement>('[aria-label="Decrease servings"]')!;
    const increase = root.querySelector<HTMLButtonElement>('[aria-label="Increase servings"]')!;

    expect(decrease.disabled).toBe(true);
    for (let count = 0; count < 25; count += 1) increase.click();
    fixture.detectChanges();

    expect(text(root, '[data-testid="selected-servings"]')).toBe('20 servings');
    expect(increase.disabled).toBe(true);
  });

  it('keeps ingredient completion local, accessible, and non-sticky', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const checkbox = root.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const ingredients = root.querySelector<HTMLElement>('.cooking-ingredients')!;

    checkbox.click();
    fixture.detectChanges();

    expect(checkbox.checked).toBe(true);
    expect(checkbox.closest('li')?.classList.contains('is-checked')).toBe(true);
    expect(checkbox.closest('label')?.textContent).toContain('Rice');
    expect(getComputedStyle(ingredients).position).not.toBe('sticky');
  });

  it('supports bounded and direct step navigation with semantic progress', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const previous = button(root, 'Previous step');
    const progress = root.querySelector<HTMLProgressElement>('progress')!;

    expect(previous.disabled).toBe(true);
    const next = button(root, 'Next step');
    expect(getComputedStyle(next).display).toBe('inline-flex');
    expect(getComputedStyle(next).whiteSpace).toBe('nowrap');
    expect(next.querySelector('span')?.textContent).toBe('Next step');
    expect(next.querySelector('mat-icon')?.textContent?.trim()).toBe('chevron_right');
    expect(progress.value).toBeCloseTo(100 / 3);
    expect(root.querySelector('[aria-current="step"]')?.textContent).toContain('Prepare');

    button(root, 'Next step').click();
    fixture.detectChanges();
    expect(root.textContent).toContain('Step 2 of 3');
    expect(progress.value).toBeCloseTo(200 / 3);
    expect(previous.disabled).toBe(false);
    expect(root.querySelector('.cooking-progress .is-complete')?.textContent)
      .toContain('Completed');

    root.querySelectorAll<HTMLButtonElement>('.cooking-progress button')[2]?.click();
    fixture.detectChanges();
    expect(root.textContent).toContain('Step 3 of 3');
    expect(progress.value).toBe(100);
    expect(button(root, 'Cook again')).toBeTruthy();
  });

  it('Cook again resets steps, checklist, and timer while preserving servings', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-31T12:00:00Z'));
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    click(root, '[aria-label="Increase servings"]');
    root.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();
    button(root, 'Start').click();
    vi.advanceTimersByTime(5000);
    root.querySelectorAll<HTMLButtonElement>('.cooking-progress button')[2]?.click();
    fixture.detectChanges();

    button(root, 'Cook again').click();
    fixture.detectChanges();

    expect(root.textContent).toContain('Step 1 of 3');
    expect(text(root, '[data-testid="selected-servings"]')).toBe('5 servings');
    expect(text(root, '[data-testid="timer-display"]')).toBe('00:00');
    expect(root.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false);
    expect(button(root, 'Start')).toBeTruthy();
  });

  it('uses timestamps across pause/resume and keeps one timer through other interactions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-31T12:00:00Z'));
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const timer = timerControls(fixture);
    const frameworkTimerCount = vi.getTimerCount();

    timer.toggleTimer();
    fixture.detectChanges();
    expect(vi.getTimerCount()).toBe(frameworkTimerCount + 1);
    vi.advanceTimersByTime(61_000);
    fixture.detectChanges();
    expect(text(root, '[data-testid="timer-display"]')).toBe('01:01');

    button(root, 'Next step').click();
    click(root, '[aria-label="Increase servings"]');
    root.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();
    fixture.detectChanges();
    expect(text(root, '[data-testid="timer-display"]')).toBe('01:01');

    timer.toggleTimer();
    fixture.detectChanges();
    vi.advanceTimersByTime(10_000);
    fixture.detectChanges();
    expect(text(root, '[data-testid="timer-display"]')).toBe('01:01');

    timer.toggleTimer();
    fixture.detectChanges();
    vi.advanceTimersByTime(3_600_000);
    fixture.detectChanges();
    expect(text(root, '[data-testid="timer-display"]')).toBe('01:01:01');
    expect(root.querySelector('[data-testid="timer-display"]')?.hasAttribute('aria-live'))
      .toBe(false);

    timer.resetTimer();
    fixture.detectChanges();
    expect(text(root, '[data-testid="timer-display"]')).toBe('00:00');
    expect(vi.getTimerCount()).toBeLessThanOrEqual(frameworkTimerCount);
  });

  it('cleans up its display interval when destroyed', () => {
    vi.useFakeTimers();
    const fixture = createFixture();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    timerControls(fixture).toggleTimer();

    expect(setIntervalSpy).toHaveBeenCalledOnce();
    const refreshHandle = setIntervalSpy.mock.results[0]?.value;
    fixture.destroy();
    expect(clearIntervalSpy).toHaveBeenCalledWith(refreshHandle);
  });
});

function createFixture(
  recipe: RecipeCookingViewDto = cookingView()
): ComponentFixture<RecipeCookingModeComponent> {
  TestBed.configureTestingModule({ imports: [RecipeCookingModeComponent] });
  const fixture = TestBed.createComponent(RecipeCookingModeComponent);
  fixture.componentRef.setInput('recipe', recipe);
  fixture.detectChanges();
  return fixture;
}

function cookingView(): RecipeCookingViewDto {
  return {
    id: 42,
    name: 'Chicken Rice Bowl',
    imageUrl: 'https://cdn.example.com/recipes/chicken-rice.jpg',
    description: 'A balanced bowl for dinner or meal prep.',
    totalTimeMinutes: 35,
    baseServings: 4,
    caloriesTotal: 800,
    proteinTotal: 40,
    carbsTotal: 100,
    badges: ['High Protein', 'Meal Prep'],
    ingredients: [
      { id: 8, name: 'Chicken', quantity: 400, unit: 'g', displayOrder: 2 },
      { id: 7, name: 'Rice', quantity: 200, unit: 'g', displayOrder: 1 },
      { id: 9, name: 'Seasoning', quantity: 1.25, unit: 'tsp', displayOrder: 3 },
    ],
    steps: [
      { order: 3, title: 'Serve', instruction: 'Divide into bowls and serve.' },
      { order: 1, title: 'Prepare ingredients', instruction: 'Measure and season everything.' },
      { order: 2, title: 'Cook', instruction: 'Cook the chicken and rice.' },
    ],
  };
}

function text(root: HTMLElement, selector: string): string {
  return root.querySelector(selector)?.textContent?.trim() ?? '';
}

function click(root: HTMLElement, selector: string): void {
  const control = root.querySelector<HTMLElement>(selector);
  if (!control) throw new Error(`Control "${selector}" was not found.`);
  control.click();
}

function button(root: HTMLElement, label: string): HTMLButtonElement {
  const result = Array.from(root.querySelectorAll('button'))
    .find(candidate => candidate.textContent?.trim().includes(label));
  if (!result) throw new Error(`Button "${label}" was not found.`);
  return result;
}

function timerControls(fixture: ComponentFixture<RecipeCookingModeComponent>): {
  toggleTimer(): void;
  resetTimer(): void;
} {
  return fixture.componentInstance as unknown as {
    toggleTimer(): void;
    resetTimer(): void;
  };
}

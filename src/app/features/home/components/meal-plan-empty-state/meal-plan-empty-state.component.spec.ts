/** Meal Plan onboarding tests protect current no-plan copy and unavailable-route semantics. */
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { MealPlanEmptyStateComponent } from './meal-plan-empty-state.component';

describe('MealPlanEmptyStateComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MealPlanEmptyStateComponent] });
  });

  it('renders the approved no-plan onboarding with a semantic heading', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('section')?.getAttribute('aria-labelledby'))
      .toBe('meal-plan-empty-title');
    expect(root.querySelector('h2')?.textContent).toContain('Plan your meals for the week');
    expect(root.textContent).toContain('preferences and schedule');
  });

  it('does not emit while unavailable and emits once when enabled', () => {
    const fixture = createFixture();
    const triggered = vi.fn();
    fixture.componentInstance.actionTriggered.subscribe(triggered);
    const action = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(action.disabled).toBe(true);
    expect(action.getAttribute('aria-disabled')).toBe('true');
    action.click();
    expect(triggered).not.toHaveBeenCalled();

    fixture.componentRef.setInput('actionDisabled', false);
    fixture.detectChanges();
    action.click();
    expect(triggered).toHaveBeenCalledOnce();
  });
});

function createFixture() {
  const fixture = TestBed.createComponent(MealPlanEmptyStateComponent);
  fixture.detectChanges();
  return fixture;
}

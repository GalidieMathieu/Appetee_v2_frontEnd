import { TestBed } from '@angular/core/testing';
import { nutritionPlanSummary } from '@app/core/shared/data-access/meal-plan/testing/meal-plan.fixtures';
import { NutritionPlanCardComponent } from './nutrition-plan-card.component';
import { vi } from 'vitest';

describe('NutritionPlanCardComponent', () => {
  async function render(easy = false) {
    await TestBed.configureTestingModule({ imports: [NutritionPlanCardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(NutritionPlanCardComponent);
    fixture.componentRef.setInput('plan', easy
      ? { ...nutritionPlanSummary(), mode: 'easy', targets: null, goal: null, activityLevel: null }
      : { ...nutritionPlanSummary(), targets: { caloriesKcal: 2200, proteinG: 140, carbsG: 260, fatG: null } });
    fixture.detectChanges();
    return fixture;
  }

  it('shows server targets, units and accessible unknown rather than zero', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('2,200 kcal');
    expect(fixture.nativeElement.querySelector('[aria-label="Unknown"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Estimated daily targets');
  });

  it('hides all targets for Easy and does not invent descriptions or Advanced mode', async () => {
    const fixture = await render(true);
    expect(fixture.nativeElement.querySelector('dl')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('4 meals / day');
    expect(fixture.nativeElement.textContent).not.toContain('Advanced');
  });

  it('emits named intent without persistence and displays only the input Current state', async () => {
    const fixture = await render();
    const use = vi.fn(); fixture.componentInstance.usePlan.subscribe(use);
    const button = fixture.nativeElement.querySelector('[aria-label="Use this plan: Plan 1"]') as HTMLButtonElement;
    button.click(); expect(use).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('current', true); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Current');
    expect(fixture.nativeElement.querySelector('[aria-label^="Use this plan:"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="More actions for Plan 1"]')).not.toBeNull();
  });

  it('prevents pending/disabled repeats and supports long card names', async () => {
    const fixture = await render();
    fixture.componentRef.setInput('pending', 'use'); fixture.componentRef.setInput('disabled', true);
    fixture.componentRef.setInput('plan', { ...nutritionPlanSummary(), name: 'Long training phase '.repeat(10) });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h2').textContent).toContain('Long training');
    expect(fixture.nativeElement.querySelector('[aria-label^="Use this plan:"]').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('article').getAttribute('aria-busy')).toBe('true');
  });
});

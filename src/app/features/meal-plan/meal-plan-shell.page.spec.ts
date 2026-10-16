import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { routes } from '../../app.routes';
import { authGuard } from '../../core/auth/auth.guard';
import { MealPlanShellPage } from './meal-plan-shell.page';
import { MEAL_PLAN_ROUTES } from './meal-plan.routes';

describe('MealPlanShellPage', () => {
  it('provides a compile-safe outlet without rendering future phase content', async () => {
    await TestBed.configureTestingModule({
      imports: [MealPlanShellPage],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(MealPlanShellPage);
    fixture.detectChanges();

    const shell = fixture.nativeElement.querySelector('main') as HTMLElement | null;
    expect(shell?.getAttribute('aria-label')).toBe('Meal Plan');
    expect(shell?.querySelector('router-outlet')).not.toBeNull();
    expect(shell?.textContent).toContain('Planner');
  });

  it('keeps the lazy feature under the existing authenticated layout', () => {
    const authenticatedBranch = routes.find(route => route.canActivate?.includes(authGuard));
    const mealPlanEntry = authenticatedBranch?.children?.find(route => route.path === 'meal-plan');

    expect(mealPlanEntry?.loadChildren).toBeDefined();
    expect(MEAL_PLAN_ROUTES).toHaveLength(1);
    expect(MEAL_PLAN_ROUTES[0]?.component).toBe(MealPlanShellPage);
    expect(MEAL_PLAN_ROUTES[0]?.children?.map(route => route.path)).toEqual(['', 'planner', 'nutrition-plans/create/intermediate', 'nutrition-plans/:planId/edit', 'nutrition-plans/create/easy', 'nutrition-plans']);
  });
});

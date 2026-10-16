import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialog } from '@angular/material/dialog';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { NutritionPlanApi } from '@app/core/shared/data-access/meal-plan/nutrition-plan.api';
import { NutritionPlanListDto, NutritionPlanMutationDto } from '@app/core/shared/data-access/meal-plan/nutrition-plan.model';
import { nutritionPlanList, nutritionPlan } from '@app/core/shared/data-access/meal-plan/testing/meal-plan.fixtures';
import { NutritionPlanCardComponent } from './nutrition-plan-card.component';
import { NutritionPlansPage } from './nutrition-plans.page';
import { NutritionPlansPageFacade } from '../state/nutrition-plans-page.facade';

describe('NutritionPlansPage F04 composition', () => {
  let fixture: ComponentFixture<NutritionPlansPage>;
  const getPlans = vi.fn();
  const duplicatePlan = vi.fn();
  const deletePlan = vi.fn();
  const setCurrentPlan = vi.fn();

  beforeEach(async () => {
    for (const mock of [getPlans, duplicatePlan, deletePlan, setCurrentPlan]) mock.mockReset();
    getPlans.mockReturnValue(of(nutritionPlanList([1, 2])));
    await TestBed.configureTestingModule({ imports: [NutritionPlansPage], providers: [
      NutritionPlansPageFacade,
      provideRouter([]),
      { provide: MAT_DIALOG_DEFAULT_OPTIONS, useValue: { enterAnimationDuration: 0, exitAnimationDuration: 0 } },
      { provide: NutritionPlanApi, useValue: { getPlans, duplicatePlan, deletePlan, setCurrentPlan } },
    ] }).compileComponents();
  });

  afterEach(() => TestBed.inject(MatDialog).closeAll());

  function render() {
    fixture = TestBed.createComponent(NutritionPlansPage); fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('does not claim empty before a successful query; handles loaded-empty/no Current', () => {
    const pending = new Subject<NutritionPlanListDto>(); getPlans.mockReturnValue(pending);
    const page = render();
    expect(page.textContent).toContain('Loading plans');
    expect(page.textContent).not.toContain('No nutrition plans yet');
    pending.next(nutritionPlanList([])); pending.complete(); fixture.detectChanges();
    expect(page.textContent).toContain('No nutrition plans yet');
    expect(page.textContent).toContain('No Current plan');
    expect(page.querySelectorAll('a[href="/meal-plan/nutrition-plans/create/easy"]')).toHaveLength(0);
    expect(page.textContent).toContain('Choose Create Nutrition Plan above');
  });

  it('renders exactly one settings-derived Current badge, switches only on receipt, then refreshes', async () => {
    const page = render();
    expect(page.querySelectorAll('.plan-card__current')).toHaveLength(1);
    const response = new Subject<NutritionPlanMutationDto>(); setCurrentPlan.mockReturnValue(response);
    const second = fixture.debugElement.queryAll(By.directive(NutritionPlanCardComponent))[1]!;
    (second.componentInstance as NutritionPlanCardComponent).usePlan.emit(); fixture.detectChanges();
    expect(page.querySelector('.plan-card__current')?.closest('article')?.getAttribute('aria-label')).toBe('Plan 1');
    const switched = { ...nutritionPlanList([2, 1]), revision: '9' };
    getPlans.mockReturnValue(of(switched));
    response.next({ revision: '9', settings: switched.settings, plan: nutritionPlan(2),
      deletedPlanId: null, profile: null, plannerInvalidated: true });
    response.complete(); await fixture.whenStable(); fixture.detectChanges();
    expect(page.querySelectorAll('.plan-card__current')).toHaveLength(1);
    expect(page.querySelector('.plan-card__current')?.closest('article')?.getAttribute('aria-label')).toBe('Plan 2');
  });

  it('preserves stale cards after failed refresh and offers read-only retry', () => {
    const page = render();
    getPlans.mockReturnValue(throwError(() => new Error('List unavailable')));
    fixture.componentInstance.vm.refresh(); fixture.detectChanges();
    expect(page.querySelectorAll('app-nutrition-plan-card')).toHaveLength(2);
    expect(page.textContent).toContain('out of date');
    expect(page.textContent).toContain('Try loading again');
    expect(page.querySelector<HTMLButtonElement>('[aria-label="Use this plan: Plan 2"]')?.disabled).toBe(true);
  });

  it('renders 50 plans and disables duplicate without losing the Current marker', () => {
    getPlans.mockReturnValue(of(nutritionPlanList(Array.from({ length: 50 }, (_, i) => i + 1))));
    const page = render();
    expect(page.querySelectorAll('app-nutrition-plan-card')).toHaveLength(50);
    expect(page.textContent).toContain('limit of 50 plans');
    expect(page.querySelectorAll('.plan-card__current')).toHaveLength(1);
    for (const card of fixture.debugElement.queryAll(By.directive(NutritionPlanCardComponent))) {
      expect((card.componentInstance as NutritionPlanCardComponent).duplicateDisabled()).toBe(true);
    }
  });

  it('uses a real Material dialog, explains Current deletion and restores focus on cancel', async () => {
    const page = render();
    const trigger = page.querySelector<HTMLButtonElement>('[aria-label="More actions for Plan 1"]')!;
    trigger.focus();
    (fixture.debugElement.query(By.directive(NutritionPlanCardComponent)).componentInstance as NutritionPlanCardComponent).deletePlan.emit();
    fixture.detectChanges(); await fixture.whenStable();
    expect(document.querySelector('mat-dialog-container')?.textContent).toContain('No replacement plan');
    expect(document.querySelector('mat-dialog-container')?.textContent).toContain('saved meals and food will not be deleted');
    expect(deletePlan).not.toHaveBeenCalled();
    const closed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0]!.afterClosed());
    fixture.componentInstance.vm.cancelDelete(); await closed; await fixture.whenStable();
    expect(document.querySelector('mat-dialog-container')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes only after acknowledged deletion and focuses the list heading when the trigger disappears', async () => {
    const page = render();
    const response = new Subject<NutritionPlanMutationDto>(); deletePlan.mockReturnValue(response);
    (fixture.debugElement.query(By.directive(NutritionPlanCardComponent)).componentInstance as NutritionPlanCardComponent).deletePlan.emit();
    fixture.detectChanges(); await fixture.whenStable();
    fixture.componentInstance.vm.confirmDelete(); fixture.detectChanges();
    expect(page.querySelectorAll('app-nutrition-plan-card')).toHaveLength(2);
    expect(TestBed.inject(MatDialog).openDialogs[0]?.disableClose).toBe(true);
    const remaining = { ...nutritionPlanList([2]), revision: '9', settings: { currentNutritionPlanId: null, currentPlan: null } };
    getPlans.mockReturnValue(of(remaining));
    const closed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0]!.afterClosed());
    response.next({ revision: '9', settings: remaining.settings, plan: null,
      deletedPlanId: 1, profile: null, plannerInvalidated: true }); response.complete();
    await closed; await fixture.whenStable(); fixture.detectChanges();
    expect(page.querySelectorAll('app-nutrition-plan-card')).toHaveLength(1);
    expect(page.querySelectorAll('.plan-card__current')).toHaveLength(0);
    expect(document.activeElement).toBe(page.querySelector('h1'));
  });
});

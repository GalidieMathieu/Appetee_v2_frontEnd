import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialog } from '@angular/material/dialog';
import { Subject, of, firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { NutritionPlanApi } from '@app/core/shared/data-access/meal-plan/nutrition-plan.api';
import { NutritionPlanMutationDto } from '@app/core/shared/data-access/meal-plan/nutrition-plan.model';
import { MealPlanContextStore } from '@app/core/shared/data-access/meal-plan/meal-plan-context.store';
import { nutritionPlanList, nutritionPlan } from '@app/core/shared/data-access/meal-plan/testing/meal-plan.fixtures';
import { NutritionPlanDraftState } from '../state/nutrition-plan-draft.state';
import { NutritionPlanFlowFacade } from '../state/nutrition-plan-flow.facade';
import { EasyPlanCreatePage } from './easy-plan-create.page';
import { MEAL_PLAN_ROUTES } from '../meal-plan.routes';

describe('EasyPlanCreatePage', () => {
  let fixture: ComponentFixture<EasyPlanCreatePage>;
  const getPlans = vi.fn(); const createPlan = vi.fn(); const navigateByUrl = vi.fn();
  beforeEach(async () => {
    getPlans.mockReset(); createPlan.mockReset(); navigateByUrl.mockReset();
    navigateByUrl.mockResolvedValue(true); getPlans.mockReturnValue(of(nutritionPlanList([])));
    await TestBed.configureTestingModule({ imports: [EasyPlanCreatePage], providers: [
      NutritionPlanDraftState, NutritionPlanFlowFacade,
      { provide: NutritionPlanApi, useValue: { getPlans, createPlan } },
      { provide: Router, useValue: { navigateByUrl } },
    ] }).compileComponents();
    fixture = TestBed.createComponent(EasyPlanCreatePage); fixture.detectChanges();
  });
  it('renders one compact form with only metadata and eight native meal choices', () => {
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelectorAll('form')).toHaveLength(1);
    expect(page.querySelectorAll('input[type="radio"]')).toHaveLength(8);
    expect(page.textContent).toContain('individual days later');
    expect(Object.keys(fixture.componentInstance.vm.form.controls)).toEqual(['name', 'defaultMealsPerDay']);
    expect(page.querySelector('[formControlName="calculationSex"]')).toBeNull();
    expect(document.activeElement).toBe(page.querySelector('h1'));
  });
  it('shows a focused summary linked to local invalid fields without a POST', () => {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="#easy-name"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#easy-name').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Creation error');
    expect(createPlan).not.toHaveBeenCalled();
  });
  it('updates confirmed Core before navigating and sends a strict Easy payload', () => {
    const response = new Subject<NutritionPlanMutationDto>(); createPlan.mockReturnValue(response);
    fixture.componentInstance.vm.form.setValue({ name: '  Simple Week  ', defaultMealsPerDay: 4 });
    fixture.componentInstance.vm.create(); fixture.detectChanges();
    expect(createPlan).toHaveBeenCalledWith({ name: 'Simple Week', mode: 'easy', defaultMealsPerDay: 4 }, '8');
    expect(navigateByUrl).not.toHaveBeenCalled();
    navigateByUrl.mockImplementation(() => {
      expect(TestBed.inject(MealPlanContextStore).revision()).toBe('9');
      expect(TestBed.inject(MealPlanContextStore).settings()?.currentNutritionPlanId).toBe(1);
      return Promise.resolve(true);
    });
    response.next({ revision: '9', settings: nutritionPlanList([1]).settings, plan: nutritionPlan(1),
      deletedPlanId: null, profile: null, plannerInvalidated: true }); response.complete();
    expect(navigateByUrl).toHaveBeenCalledOnce();
  });
  it('Cancel performs navigation only, without creating or saving a draft', () => {
    (fixture.nativeElement.querySelector('.easy-page__actions button[type="button"]') as HTMLButtonElement).click();
    expect(navigateByUrl).toHaveBeenCalledOnce(); expect(createPlan).not.toHaveBeenCalled();
  });
});

describe('Easy creation routed journey', () => {
  const getPlans = vi.fn(); const createPlan = vi.fn();
  beforeEach(() => {
    getPlans.mockReset(); createPlan.mockReset();
    getPlans.mockReturnValue(of(nutritionPlanList([])));
    TestBed.configureTestingModule({ providers: [
      provideRouter([{ path: 'meal-plan', children: MEAL_PLAN_ROUTES }]),
      { provide: MAT_DIALOG_DEFAULT_OPTIONS, useValue: { enterAnimationDuration: 0, exitAnimationDuration: 0 } },
      { provide: NutritionPlanApi, useValue: { getPlans, createPlan } },
    ] });
  });
  afterEach(() => vi.restoreAllMocks());

  it('opens a separate page, creates once and returns to a refreshed dashboard containing the confirmed plan', async () => {
    const harness = await RouterTestingHarness.create('/meal-plan/nutrition-plans');
    const response = new Subject<NutritionPlanMutationDto>(); createPlan.mockReturnValue(response);
    expect(harness.routeNativeElement?.querySelector('form')).toBeNull();
    const create = harness.routeNativeElement?.querySelector<HTMLButtonElement>('#meal-plan-create')!;
    create.click(); await harness.fixture.whenStable(); harness.detectChanges();
    const choiceClosed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0]!.afterClosed());
    document.querySelector<HTMLButtonElement>('.choice-dialog__option')!.click();
    await choiceClosed;
    await harness.fixture.whenStable(); harness.detectChanges();
    const page = harness.routeDebugElement!.query(By.directive(EasyPlanCreatePage)).componentInstance as EasyPlanCreatePage;
    expect(TestBed.inject(Router).url).toBe('/meal-plan/nutrition-plans/create/easy');
    page.vm.form.setValue({ name: 'Confirmed Easy', defaultMealsPerDay: 3 }); page.vm.create();
    expect(createPlan).toHaveBeenCalledWith({ name: 'Confirmed Easy', mode: 'easy', defaultMealsPerDay: 3 }, '8');
    const plan = { ...nutritionPlan(1), name: 'Confirmed Easy', mode: 'easy' as const,
      defaultMealsPerDay: 3, targets: null, goal: null, activityLevel: null, calculationInputs: null,
      calculationPolicyVersion: null, calculatedAt: null, rmrKcal: null, maintenanceKcal: null };
    const settings = { currentNutritionPlanId: 1, currentPlan: { id: 1, name: plan.name,
      mode: 'easy' as const, defaultMealsPerDay: 3, targets: null, calculationPolicyVersion: null } };
    getPlans.mockReturnValue(of({ revision: '9', plans: [plan], settings }));
    response.next({ revision: '9', plan, settings, deletedPlanId: null, profile: null, plannerInvalidated: true }); response.complete();
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/meal-plan/nutrition-plans');
    expect(harness.routeNativeElement?.textContent).toContain('Confirmed Easy');
    expect(harness.routeNativeElement?.querySelector('form')).toBeNull();
    expect(harness.routeNativeElement?.querySelectorAll('.plan-card__current')).toHaveLength(1);
    expect(document.activeElement?.id).toBe('meal-plan-create');
    expect(createPlan).toHaveBeenCalledTimes(1);
  });

  it('guards dirty Cancel, discards only when confirmed and writes nothing', async () => {
    const harness = await RouterTestingHarness.create('/meal-plan/nutrition-plans/create/easy');
    const page = harness.routeDebugElement!.query(By.directive(EasyPlanCreatePage)).componentInstance as EasyPlanCreatePage;
    page.vm.form.setValue({ name: 'Unsaved draft', defaultMealsPerDay: 2 });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    page.vm.cancel(); await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/meal-plan/nutrition-plans/create/easy');
    expect(page.vm.form.controls.name.value).toBe('Unsaved draft');
    confirm.mockReturnValue(true); page.vm.cancel(); await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/meal-plan/nutrition-plans');
    expect(createPlan).not.toHaveBeenCalled();
    await harness.navigateByUrl('/meal-plan/nutrition-plans/create/easy');
    const reentered = harness.routeDebugElement!.query(By.directive(EasyPlanCreatePage)).componentInstance as EasyPlanCreatePage;
    expect(reentered.vm.form.controls.name.value).toBe('');
  });
});

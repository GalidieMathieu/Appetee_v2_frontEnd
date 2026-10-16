import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_URL } from '@app/core/api/api.config';
import { MEAL_PLAN_REVISION_HEADER } from './meal-plan-mutation.model';
import { NutritionPlanApi } from './nutrition-plan.api';
import { NutritionPlanMutationDto } from './nutrition-plan.model';

describe('NutritionPlanApi', () => {
  let api: NutritionPlanApi;
  let http: HttpTestingController;

  const calculation = {
    profile: {
      calculationSex: 'female' as const,
      birthYear: 1990,
      heightCm: 168.5,
      weightKg: 64.25,
    },
    goal: 'maintain' as const,
    activityLevel: 'active' as const,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        NutritionPlanApi,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
      ],
    });
    api = TestBed.inject(NutritionPlanApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('keeps preview read-only with no Meal Plan revision header', () => {
    api.previewCalculation(calculation).subscribe();

    const request = http.expectOne('/api/nutrition-plans/calculation-preview');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(calculation);
    expect(request.request.headers.has(MEAL_PLAN_REVISION_HEADER)).toBe(false);
    request.flush({});
  });

  it('loads list and complete detail through separate endpoints', () => {
    api.getPlans().subscribe();
    const list = http.expectOne('/api/nutrition-plans');
    expect(list.request.method).toBe('GET');
    expect(list.request.params.keys()).toEqual([]);
    list.flush({});

    api.getPlan(27).subscribe();
    const detail = http.expectOne('/api/nutrition-plans/27');
    expect(detail.request.method).toBe('GET');
    expect(detail.request.params.keys()).toEqual([]);
    detail.flush({});
  });

  it('sends exact create and update shapes without owner IDs or client targets', () => {
    const createBody = { name: 'Simple week', mode: 'easy' as const, defaultMealsPerDay: 4 };
    api.createPlan(createBody, '20').subscribe();
    flushMutation('POST', '/api/nutrition-plans', createBody, '20');

    const updateBody = { name: 'Training week', defaultMealsPerDay: 5 };
    api.updatePlan(27, updateBody, '21').subscribe();
    flushMutation('PUT', '/api/nutrition-plans/27', updateBody, '21');

    const intermediateBody = {
      name: 'Performance',
      mode: 'intermediate' as const,
      defaultMealsPerDay: 5,
      calculation,
      reviewedPolicyVersion: '2026.1',
      reviewedCalculationYear: 2026,
    };
    api.createPlan(intermediateBody, '22').subscribe();
    flushMutation('POST', '/api/nutrition-plans', intermediateBody, '22');
  });

  it('uses revision-protected lifecycle and Current endpoints', () => {
    api.duplicatePlan(27, '23').subscribe();
    flushMutation('POST', '/api/nutrition-plans/27/duplicate', null, '23');

    api.deletePlan(27, '24').subscribe();
    flushMutation('DELETE', '/api/nutrition-plans/27', null, '24');

    api.setCurrentPlan({ nutritionPlanId: 31 }, '25').subscribe();
    flushMutation('PUT', '/api/meal-plan/current-nutrition-plan', { nutritionPlanId: 31 }, '25');
  });

  function flushMutation(method: string, url: string, body: unknown, revision: string): void {
    const request = http.expectOne(url);
    expect(request.request.method).toBe(method);
    expect(request.request.body).toEqual(body);
    expect(request.request.headers.get(MEAL_PLAN_REVISION_HEADER)).toBe(revision);
    if (body && typeof body === 'object') {
      expect('ownerId' in body).toBe(false);
      expect('userId' in body).toBe(false);
      expect('targets' in body).toBe(false);
    }
    request.flush({} as NutritionPlanMutationDto);
  }
});

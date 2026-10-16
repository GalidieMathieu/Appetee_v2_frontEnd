import { TestBed } from '@angular/core/testing';

import { NutritionPlanSummaryDto } from './nutrition-plan.model';
import {
  NutritionPlanDetailRecord,
  NutritionPlanDetailsStore,
} from './nutrition-plan-details.store';
import {
  nutritionPlanDetail,
  nutritionPlanList,
} from './testing/meal-plan.fixtures';

type SummaryCanPoisonDetail = NutritionPlanSummaryDto extends NutritionPlanDetailRecord
  ? true
  : false;

describe('NutritionPlanDetailsStore', () => {
  let store: NutritionPlanDetailsStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(NutritionPlanDetailsStore);
    store.reset();
  });

  it('loads independent plan IDs without sharing request state', () => {
    const first = store.beginLoad(1, 0)!;
    const second = store.beginLoad(2, 0)!;

    expect(store.acceptDetail(first, nutritionPlanDetail(1), 0)).toBe(true);
    expect(store.requestState(1).status).toBe('success');
    expect(store.requestState(2).status).toBe('loading');

    expect(store.failLoad(2, second, 'Unavailable', 0, 404)).toBe(true);
    expect(store.requestState(2)).toEqual({
      status: 'error',
      error: 'Unavailable',
      httpStatus: 404,
    });
    expect(store.get(1)?.plan.id).toBe(1);
  });

  it('coalesces only the same in-flight plan ID', () => {
    expect(store.beginLoad(1, 0)).not.toBeNull();
    expect(store.beginLoad(1, 0)).toBeNull();
    expect(store.beginLoad(2, 0)).not.toBeNull();
  });

  it('keeps summary fixtures out of the complete detail cache', () => {
    const summaryIsNotDetail: SummaryCanPoisonDetail = false;
    const list = nutritionPlanList([1]);
    const token = store.beginLoad(1, 0)!;

    expect(summaryIsNotDetail).toBe(false);
    expect(list.plans[0]).not.toHaveProperty('calculationInputs');
    expect(store.get(1)).toBeNull();

    store.acceptDetail(token, nutritionPlanDetail(1), 0);
    expect(store.get(1)?.plan.calculationInputs).not.toBeNull();
  });

  it('rejects old epoch, invalidated and reset-generation responses', () => {
    const oldEpoch = store.beginLoad(1, 2)!;
    expect(store.acceptDetail(oldEpoch, nutritionPlanDetail(1), 3)).toBe(false);

    store.invalidate(1);
    expect(store.acceptDetail(oldEpoch, nutritionPlanDetail(1), 2)).toBe(false);

    const oldIdentity = store.beginLoad(1, 3)!;
    store.reset();
    expect(store.acceptDetail(oldIdentity, nutritionPlanDetail(1), 3)).toBe(false);
    expect(store.get(1)).toBeNull();
  });
});


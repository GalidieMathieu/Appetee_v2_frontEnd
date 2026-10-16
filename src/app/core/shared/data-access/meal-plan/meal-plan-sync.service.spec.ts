import { TestBed } from '@angular/core/testing';

import { MealPlanContextStore } from './meal-plan-context.store';
import { MealPlanSyncService } from './meal-plan-sync.service';
import { MealPlannerStore } from './meal-planner.store';
import { NutritionPlanDetailsStore } from './nutrition-plan-details.store';
import { NutritionPlansStore } from './nutrition-plans.store';
import { NutritionProfileStore } from '../user/nutrition-profile.store';
import {
  nutritionPlan,
  nutritionPlanDetail,
  nutritionPlanList,
  nutritionProfile,
  plannerRange,
} from './testing/meal-plan.fixtures';
import { NutritionPlanMutationDto } from './nutrition-plan.model';

describe('MealPlanSyncService', () => {
  let service: MealPlanSyncService;
  let context: MealPlanContextStore;
  let planner: MealPlannerStore;
  let plans: NutritionPlansStore;
  let details: NutritionPlanDetailsStore;
  let profile: NutritionProfileStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MealPlanSyncService);
    context = TestBed.inject(MealPlanContextStore);
    planner = TestBed.inject(MealPlannerStore);
    plans = TestBed.inject(NutritionPlansStore);
    details = TestBed.inject(NutritionPlanDetailsStore);
    profile = TestBed.inject(NutritionProfileStore);
    context.reset();
    planner.reset();
    plans.reset();
    details.reset();
    profile.reset();
  });

  it('does not let a newer destination read bless an older source snapshot', () => {
    const source = planner.beginLoad('2026-10-05', '2026-10-05', context.readEpoch())!;
    expect(service.observeRead({
      kind: 'planner',
      token: source,
      response: plannerRange('2026-10-05', '2026-10-05', '8'),
    })).toBe(true);

    const destination = planner.beginLoad('2026-10-06', '2026-10-06', context.readEpoch())!;
    expect(service.observeRead({
      kind: 'planner',
      token: destination,
      response: plannerRange('2026-10-06', '2026-10-06', '9'),
    })).toBe(true);

    expect(context.revision()).toBe('9');
    expect(planner.range(destination.queryKey)?.freshness).toBe('fresh');
    expect(planner.range(source.queryKey)?.observedRevision).toBe('8');
    expect(planner.range(source.queryKey)?.freshness).toBe('stale');
  });

  it('invalidates every cached planner range when Current changes', () => {
    loadRange('2026-10-05');
    loadRange('2026-10-06');

    expect(service.applyNutritionPlanReceipt('8', planReceipt({
      revision: '9',
      plannerInvalidated: true,
    }), context.identityGeneration())).toBe(true);

    expect(Object.values(planner.rangesByKey()).every(range => range.freshness === 'stale')).toBe(true);
    expect(context.settings()?.currentNutritionPlanId).toBe(2);
  });

  it('adopts a returned create profile but does not erase it for an Easy receipt profile:null', () => {
    context.replaceConfirmedContext('8', nutritionPlanList([1]).settings, context.identityGeneration());
    const savedProfile = nutritionProfile().profile!;
    expect(service.applyNutritionPlanReceipt('8', planReceipt({
      revision: '9',
      profile: savedProfile,
    }), context.identityGeneration())).toBe(true);
    expect(profile.profile()).toEqual(savedProfile);

    expect(service.applyNutritionPlanReceipt('9', planReceipt({
      revision: '10',
      profile: null,
    }), context.identityGeneration())).toBe(true);
    expect(profile.profile()).toEqual(savedProfile);
    expect(profile.revision()).toBe('10');
  });

  it('rejects a pre-write GET and its late error after the read epoch advances', () => {
    context.replaceConfirmedContext('8', nutritionPlanList([1]).settings, context.identityGeneration());
    const oldRead = planner.beginLoad('2026-10-05', '2026-10-05', context.readEpoch())!;
    context.advanceReadEpoch();

    expect(service.applyNutritionPlanReceipt('8', planReceipt({ revision: '9' }),
      context.identityGeneration())).toBe(true);
    expect(service.observeRead({
      kind: 'planner',
      token: oldRead,
      response: plannerRange('2026-10-05', '2026-10-05', '8'),
    })).toBe(false);
    expect(planner.failLoad(oldRead, 'late failure', context.readEpoch())).toBe(false);
    expect(context.revision()).toBe('9');
  });

  it('rebases an unaffected fresh range only across a verified own-write transition', () => {
    const key = loadRange('2026-10-05');
    const detailToken = details.beginLoad(1, context.readEpoch())!;
    service.observeRead({ kind: 'planDetail', token: detailToken, response: nutritionPlanDetail(1) });

    expect(service.applyNutritionPlanReceipt('8', planReceipt({
      revision: '9',
      plan: nutritionPlan(2),
      plannerInvalidated: false,
    }), context.identityGeneration())).toBe(true);
    expect(planner.range(key)?.observedRevision).toBe('9');
    expect(planner.range(key)?.freshness).toBe('fresh');

    expect(service.applyNutritionPlanReceipt('9', planReceipt({ revision: '12' }),
      context.identityGeneration())).toBe(false);
    expect(context.revision()).toBeNull();
    expect(planner.range(key)?.freshness).toBe('stale');
  });

  it('emits changed events after confirmed stores update and does not replay them', () => {
    context.replaceConfirmedContext('8', nutritionPlanList([1]).settings, context.identityGeneration());
    const revisions: Array<string | null> = [];
    service.changed$.subscribe(() => revisions.push(context.revision()));

    service.applyNutritionPlanReceipt('8', planReceipt({ revision: '9' }),
      context.identityGeneration());
    expect(revisions).toEqual(['9']);

    const lateEvents: unknown[] = [];
    service.changed$.subscribe(event => lateEvents.push(event));
    expect(lateEvents).toEqual([]);
  });

  function loadRange(date: string): string {
    const token = planner.beginLoad(date, date, context.readEpoch())!;
    service.observeRead({ kind: 'planner', token, response: plannerRange(date, date, '8') });
    return token.queryKey;
  }

  function planReceipt(overrides: Partial<NutritionPlanMutationDto>): NutritionPlanMutationDto {
    return {
      revision: '9',
      settings: {
        currentNutritionPlanId: 2,
        currentPlan: {
          id: 2,
          name: 'Plan 2',
          mode: 'intermediate',
          defaultMealsPerDay: 4,
          targets: nutritionPlan(2).targets,
          calculationPolicyVersion: '2026.1',
        },
      },
      plan: nutritionPlan(2),
      deletedPlanId: null,
      profile: null,
      plannerInvalidated: false,
      ...overrides,
    };
  }
});

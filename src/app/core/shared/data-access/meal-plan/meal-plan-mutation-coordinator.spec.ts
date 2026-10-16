import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Subject } from 'rxjs';

import { MealPlanContextStore } from './meal-plan-context.store';
import { MealPlanMutationCoordinator } from './meal-plan-mutation-coordinator';
import {
  MealPlanMutationOperation,
  MealPlanMutationReceipt,
  MealPlanOperationResult,
  PlannerMutationDto,
} from './meal-plan-mutation.model';
import { nutritionPlanList, plannerRange } from './testing/meal-plan.fixtures';

describe('MealPlanMutationCoordinator', () => {
  it('settles navigation waiters on an unknown server outcome without replaying a paused queue', async () => {
    const active = new Subject<MealPlanMutationReceipt>(); let queuedExecutions = 0;
    coordinator.enqueue(quantityOperation(2, () => active)).subscribe();
    coordinator.enqueue(quantityOperation(4, () => { queuedExecutions++; return new Subject<MealPlanMutationReceipt>(); })).subscribe();
    const settled = coordinator.waitUntilSettled();
    active.error(new HttpErrorResponse({ status: 500 }));
    await settled;
    expect(coordinator.status()).toBe('unknownOutcome'); expect(coordinator.paused()).toBe(true);
    expect(queuedExecutions).toBe(0);
    coordinator.clearPauseAfterReconciliation(); expect(queuedExecutions).toBe(0);
  });
  let coordinator: MealPlanMutationCoordinator;
  let context: MealPlanContextStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    coordinator = TestBed.inject(MealPlanMutationCoordinator);
    context = TestBed.inject(MealPlanContextStore);
    coordinator.reset();
    context.reset();
    context.replaceConfirmedContext('8', nutritionPlanList([1]).settings, context.identityGeneration());
  });

  it('sends quantity 2 then only latest unsent quantity 4 on the trusted own-write chain', async () => {
    const firstResponse = new Subject<MealPlanMutationReceipt>();
    const sent: Array<{ quantity: number; revision: string }> = [];
    const result2 = firstValueFrom(coordinator.enqueue(quantityOperation(2, revision => {
      sent.push({ quantity: 2, revision });
      return firstResponse;
    })));
    const result3 = firstValueFrom(coordinator.enqueue(quantityOperation(3, revision => {
      sent.push({ quantity: 3, revision });
      return new Subject<MealPlanMutationReceipt>();
    })));
    const secondResponse = new Subject<MealPlanMutationReceipt>();
    const result4 = firstValueFrom(coordinator.enqueue(quantityOperation(4, revision => {
      sent.push({ quantity: 4, revision });
      return secondResponse;
    })));

    expect(sent).toEqual([{ quantity: 2, revision: '8' }]);
    expect((await result3).outcome).toBe('superseded');
    firstResponse.next(plannerReceipt('9'));
    firstResponse.complete();
    expect(sent).toEqual([
      { quantity: 2, revision: '8' },
      { quantity: 4, revision: '9' },
    ]);
    secondResponse.next(plannerReceipt('10'));
    secondResponse.complete();

    expect((await result2).revision).toBe('9');
    expect((await result4).revision).toBe('10');
    expect(context.revision()).toBe('10');
  });

  it('deduplicates rapid matching structural intents without merging unrelated work', async () => {
    const response = new Subject<MealPlanMutationReceipt>();
    let executions = 0;
    const first = structuralOperation('delete:item:30', () => {
      executions++;
      return response;
    });
    coordinator.enqueue(first).subscribe();
    const duplicate = firstValueFrom(coordinator.enqueue(first));
    const unrelated = structuralOperation('delete:item:31', () => {
      executions++;
      return new Subject<MealPlanMutationReceipt>();
    });
    coordinator.enqueue(unrelated).subscribe();

    expect((await duplicate).outcome).toBe('duplicate');
    expect(executions).toBe(1);
    response.next(plannerReceipt('9'));
    expect(executions).toBe(2);
  });

  it('pauses on 409 and never automatically replays queued work with a fetched revision', async () => {
    const response = new Subject<MealPlanMutationReceipt>();
    let queuedExecutions = 0;
    const conflict = firstValueFrom(coordinator.enqueue(structuralOperation('copy:week', () => response)));
    coordinator.enqueue(structuralOperation('delete:item:31', () => {
      queuedExecutions++;
      return new Subject<MealPlanMutationReceipt>();
    })).subscribe();

    response.error(new HttpErrorResponse({ status: 409, error: { code: 'revision_conflict' } }));
    expect((await conflict).outcome).toBe('conflict');
    expect(coordinator.paused()).toBe(true);
    context.replaceConfirmedContext('9', nutritionPlanList([1]).settings, context.identityGeneration());
    expect(queuedExecutions).toBe(0);
    coordinator.clearPauseAfterReconciliation();
    expect(queuedExecutions).toBe(0);
  });

  it('classifies an ambiguous transport failure as unknownOutcome and does not replay it', async () => {
    const response = new Subject<MealPlanMutationReceipt>();
    let executions = 0;
    const result = firstValueFrom(coordinator.enqueue(structuralOperation('copy:day', () => {
      executions++;
      return response;
    })));
    response.error(new HttpErrorResponse({ status: 0, statusText: 'Network error' }));

    expect((await result).outcome).toBe('unknownOutcome');
    expect(coordinator.status()).toBe('unknownOutcome');
    expect(executions).toBe(1);
  });

  it('clears outstanding work on logout and ignores the eventual old-generation receipt', async () => {
    const response = new Subject<MealPlanMutationReceipt>();
    const result = firstValueFrom(coordinator.enqueue(structuralOperation('copy:day', () => response)));
    coordinator.reset();
    context.reset();

    expect((await result).outcome).toBe('cancelled');
    response.next(plannerReceipt('9'));
    expect(context.revision()).toBeNull();
    expect(coordinator.status()).toBe('idle');
  });

  it('cancels a queued edit whose resource was deleted by the preceding receipt', async () => {
    const deleteResponse = new Subject<MealPlanMutationReceipt>();
    coordinator.enqueue({
      ...structuralOperation('delete:item:30', () => deleteResponse),
      deletesResourceKeys: ['item:30'],
    }).subscribe();
    let editExecutions = 0;
    const editResult = firstValueFrom(coordinator.enqueue({
      ...quantityOperation(4, () => {
        editExecutions++;
        return new Subject<MealPlanMutationReceipt>();
      }),
      dependsOn: ['item:30'],
    }));

    deleteResponse.next(plannerReceipt('9'));
    expect((await editResult).outcome).toBe('cancelled');
    expect(editExecutions).toBe(0);
  });

  function quantityOperation(
    quantity: number,
    execute: MealPlanMutationOperation['execute']
  ): MealPlanMutationOperation {
    return {
      context: { kind: 'setRecipeQuantity', expectedRevision: '8', itemId: 30 },
      mode: 'scalar',
      resourceKey: 'item:30',
      coalesceKey: 'item:30:quantity',
      execute,
    };
  }

  function structuralOperation(
    dedupeKey: string,
    execute: MealPlanMutationOperation['execute']
  ): MealPlanMutationOperation {
    return {
      context: { kind: 'deleteItem', expectedRevision: '8', itemId: 30 },
      mode: 'structural',
      resourceKey: 'item:30',
      dedupeKey,
      execute,
    };
  }

  function plannerReceipt(revision: string): PlannerMutationDto {
    return {
      revision,
      settings: nutritionPlanList([1]).settings,
      days: plannerRange('2026-10-05', '2026-10-05', revision).days,
      createdMealId: null,
      createdItemId: null,
    };
  }
});

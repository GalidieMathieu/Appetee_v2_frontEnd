import { TemplateRef, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { NutritionPlanFacade, NutritionPlanOperationResult } from '@app/core/shared/data-access/meal-plan/nutrition-plan.facade';
import { MealPlanContextStore } from '@app/core/shared/data-access/meal-plan/meal-plan-context.store';
import { NutritionPlanListDto } from '@app/core/shared/data-access/meal-plan/nutrition-plan.model';
import { nutritionPlanList } from '@app/core/shared/data-access/meal-plan/testing/meal-plan.fixtures';
import { NutritionPlansPageFacade } from './nutrition-plans-page.facade';

describe('NutritionPlansPageFacade', () => {
  const snapshot = signal(nutritionPlanList([1, 2]));
  const canWrite = signal(true);
  const paused = signal(false);
  const loadList = vi.fn();
  const duplicate = vi.fn();
  const deletePlan = vi.fn();
  const setCurrent = vi.fn();
  const resumeAfterReview = vi.fn();
  const open = vi.fn();
  const close = vi.fn();
  let closed: Subject<void>;
  let facade: NutritionPlansPageFacade;
  const template = {} as TemplateRef<unknown>;

  beforeEach(() => {
    for (const mock of [loadList, duplicate, deletePlan, setCurrent, resumeAfterReview, open, close]) mock.mockReset();
    snapshot.set(nutritionPlanList([1, 2])); canWrite.set(true);
    paused.set(false);
    loadList.mockImplementation(() => of(snapshot()));
    resumeAfterReview.mockReturnValue(true);
    closed = new Subject<void>();
    const dialog = { close, afterClosed: () => closed.asObservable(), disableClose: false };
    open.mockReturnValue(dialog);
    close.mockImplementation(() => { closed.next(); closed.complete(); });
    TestBed.configureTestingModule({ providers: [NutritionPlansPageFacade,
      { provide: MatDialog, useValue: { open } },
      { provide: NutritionPlanFacade, useValue: {
        plans: computed(() => snapshot().plans), loaded: signal(true), stale: signal(false),
        request: signal({ status: 'success', error: null }), revision: computed(() => snapshot().revision),
        settings: computed(() => snapshot().settings), canWrite, paused,
        loadList, duplicate, delete: deletePlan, setCurrent, resumeAfterReview,
      } },
    ] });
    facade = TestBed.inject(NutritionPlansPageFacade);
  });

  it('initializes once, derives cards/Current from Core and revalidates on focus', () => {
    facade.enter(); facade.enter();
    expect(loadList).toHaveBeenCalledTimes(1);
    expect(facade.plans()).toBe(snapshot().plans);
    expect(facade.currentId()).toBe(1);
    facade.onWindowFocus();
    expect(loadList).toHaveBeenCalledTimes(2);
  });

  it('disables double intent while pending and never duplicates locally', async () => {
    facade.enter();
    const response = new Subject<NutritionPlanOperationResult>();
    duplicate.mockReturnValue(response);
    const before = facade.plans();
    facade.duplicate(1); facade.duplicate(1);
    expect(duplicate).toHaveBeenCalledTimes(1);
    expect(facade.plans()).toBe(before);
    expect(facade.pending()).toEqual({ id: 1, action: 'duplicate' });
    response.next({ operationId: 1, kind: 'duplicateNutritionPlan', outcome: 'confirmed', revision: '9' });
    await Promise.resolve();
    expect(loadList).toHaveBeenCalledTimes(2);
    expect(facade.success()).toContain('Current plan is unchanged');
  });

  it('prevents duplicates at the 50-plan cap and stale/unavailable actions', () => {
    snapshot.set(nutritionPlanList(Array.from({ length: 50 }, (_, i) => i + 1)));
    facade.duplicate(1);
    expect(duplicate).not.toHaveBeenCalled();
    canWrite.set(false); facade.use(2); facade.requestDelete(2, template);
    expect(setCurrent).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
    canWrite.set(true); facade.use(999);
    expect(setCurrent).not.toHaveBeenCalled();
  });

  it('opens a focus-restoring Material confirmation, does not delete on open/cancel', () => {
    facade.requestDelete(1, template);
    expect(facade.deleteIsCurrent()).toBe(true);
    expect(open.mock.calls[0]?.[1]).toMatchObject({ restoreFocus: true, autoFocus: 'first-tabbable' });
    expect(deletePlan).not.toHaveBeenCalled();
    facade.cancelDelete();
    expect(facade.deleteId()).toBeNull();
  });

  it('captures reviewed delete authority and keeps card/dialog on 409 instead of refreshing/replaying', () => {
    facade.enter(); facade.requestDelete(1, template);
    deletePlan.mockReturnValue(of({ outcome: 'conflict', revision: null, code: 'revision_conflict', traceId: 'test-trace' }));
    facade.confirmDelete(); facade.confirmDelete();
    expect(deletePlan).toHaveBeenCalledTimes(1);
    expect(deletePlan).toHaveBeenCalledWith(1, '8');
    expect(facade.plans()).toHaveLength(2);
    expect(facade.deleteId()).toBe(1);
    expect(close).not.toHaveBeenCalled();
    expect(facade.diagnostic()).toContain('test-trace');
    snapshot.set({ ...snapshot(), revision: '9' });
    facade.refresh();
    expect(resumeAfterReview).not.toHaveBeenCalled();
    facade.confirmReview();
    expect(resumeAfterReview).toHaveBeenCalledWith('9');
    expect(facade.deleteId()).toBeNull();
    expect(deletePlan).toHaveBeenCalledTimes(1);
  });

  it('requires reconciliation after unknown outcome and preserves Current until acknowledgment', () => {
    setCurrent.mockReturnValue(of({ outcome: 'unknownOutcome', revision: null }));
    facade.use(2); facade.use(2);
    expect(setCurrent).toHaveBeenCalledTimes(1);
    expect(facade.currentId()).toBe(1);
    expect(facade.requiresReview()).toBe(true);
    expect(facade.error()).toContain('unknown');
  });

  it('rejects changed delete confirmation authority before dispatch', () => {
    facade.requestDelete(1, template);
    snapshot.set({ ...snapshot(), revision: '9' });
    facade.confirmDelete();
    expect(deletePlan).not.toHaveBeenCalled();
    expect(facade.requiresReview()).toBe(true);
  });

  it('clears transient state on identity reset, ignores late work and allows re-entry', () => {
    const response = new Subject<NutritionPlanListDto>();
    loadList.mockReturnValue(response);
    facade.enter();
    TestBed.inject(MealPlanContextStore).reset();
    response.next(nutritionPlanList([7]));
    expect(facade.loading()).toBe(false);
    expect(facade.error()).toBeNull();
    loadList.mockReturnValue(of(snapshot())); facade.enter();
    expect(loadList).toHaveBeenCalledTimes(2);
  });

  it('offers review on re-entry when the shared coordinator remains paused', () => {
    paused.set(true); canWrite.set(false);
    facade.enter();
    expect(facade.requiresReview()).toBe(true);
    expect(facade.reviewedRefresh()).toBe('8');
    expect(facade.error()).toContain('reconciliation');
    expect(duplicate).not.toHaveBeenCalled();
    facade.confirmReview();
    expect(resumeAfterReview).toHaveBeenCalledWith('8');
  });
});

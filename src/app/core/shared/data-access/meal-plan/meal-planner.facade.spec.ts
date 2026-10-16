import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MealPlannerFacade } from './meal-planner.facade';
import { MealPlannerApi } from './meal-planner.api';
import { MealPlannerStore } from './meal-planner.store';
import { MealPlanContextStore } from './meal-plan-context.store';
import { MealPlannerRangeDto } from './meal-plan.model';
import { plannerRange } from './testing/meal-plan.fixtures';
describe('MealPlannerFacade', () => {
    const getRange = vi.fn();
    let facade: MealPlannerFacade;
    let store: MealPlannerStore;
    beforeEach(() => { getRange.mockReset(); TestBed.configureTestingModule({ providers: [{ provide: MealPlannerApi, useValue: { getRange } }] }); facade = TestBed.inject(MealPlannerFacade); store = TestBed.inject(MealPlannerStore); });
    it('settles the single HTTP response and removes its timeout even if a test transport remains open', () => {
        const response = new Subject<MealPlannerRangeDto>(); getRange.mockReturnValue(response);
        facade.loadRange('2026-10-12', '2026-10-12').subscribe(); response.next(plannerRange('2026-10-12'));
        expect(response.observers).toHaveLength(0);
    });
    it('coalesces same-key requests and stores the complete server projection once', async () => { const response = new Subject<MealPlannerRangeDto>(); getRange.mockReturnValue(response); const first = firstValueFrom(facade.loadRange('2026-10-12', '2026-10-12')); const second = firstValueFrom(facade.loadRange('2026-10-12', '2026-10-12')); const range = plannerRange('2026-10-12'); response.next(range); response.complete(); expect(await first).toEqual(await second); expect(getRange).toHaveBeenCalledTimes(1); expect(store.data('2026-10-12:2026-10-12')).toEqual(range); expect(store.data('2026-10-12:2026-10-12')?.days[0]?.totals.fatG).toBeNull(); });
    it('shows unavailable backend without inventing data or retrying', async () => { getRange.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 }))); await expect(firstValueFrom(facade.loadRange('2026-10-12', '2026-10-12'))).rejects.toBeTruthy(); expect(store.requestState('2026-10-12:2026-10-12').error).toContain('unavailable'); expect(store.data('2026-10-12:2026-10-12')).toBeNull(); expect(TestBed.inject(MealPlanContextStore).revision()).toBeNull(); expect(getRange).toHaveBeenCalledTimes(1); });
    it('rejects omitted intermediate days rather than reconstructing them', async () => { const a = plannerRange('2026-10-12'); const b = plannerRange('2026-10-14'); getRange.mockReturnValue(of({ ...a, through: b.through, days: [...a.days, ...b.days] })); await expect(firstValueFrom(facade.loadRange(a.from, b.through))).rejects.toBeTruthy(); expect(store.data('2026-10-12:2026-10-14')).toBeNull(); });
    it('ignores an old identity response after root reset', () => { const response = new Subject<MealPlannerRangeDto>(); getRange.mockReturnValue(response); const received: MealPlannerRangeDto[] = []; facade.loadRange('2026-10-12', '2026-10-12').subscribe(value => received.push(value)); TestBed.inject(MealPlanContextStore).reset(); store.reset(); response.next(plannerRange('2026-10-12')); expect(received).toEqual([]); expect(store.rangesByKey()).toEqual({}); });
    it('keeps the active week when an old week completes', () => { const first = new Subject<MealPlannerRangeDto>(); const second = new Subject<MealPlannerRangeDto>(); getRange.mockReturnValueOnce(first).mockReturnValueOnce(second); facade.activate('2026-10-12', '2026-10-12'); facade.loadRange('2026-10-12', '2026-10-12').subscribe(); facade.activate('2026-10-19', '2026-10-19'); facade.loadRange('2026-10-19', '2026-10-19').subscribe(); second.next(plannerRange('2026-10-19')); first.next(plannerRange('2026-10-12')); expect(store.activeKey()).toBe('2026-10-19:2026-10-19'); expect(store.data(store.activeKey()!)?.from).toBe('2026-10-19'); });
});

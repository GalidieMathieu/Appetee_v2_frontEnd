import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NutritionPlanFacade } from './nutrition-plan.facade';
import { NutritionPlanApi } from './nutrition-plan.api';
import { NutritionPlanListDto, NutritionPlanMutationDto, NutritionPlanDetailDto } from './nutrition-plan.model';
import { NutritionPlansStore } from './nutrition-plans.store';
import { NutritionPlanDetailsStore } from './nutrition-plan-details.store';
import { MealPlanContextStore } from './meal-plan-context.store';
import { MealPlanMutationCoordinator } from './meal-plan-mutation-coordinator';
import { nutritionPlan, nutritionPlanDetail, nutritionPlanList, plannerRange } from './testing/meal-plan.fixtures';
import { MealPlannerStore } from './meal-planner.store';
import { MealPlanSyncService } from './meal-plan-sync.service';
describe('NutritionPlanFacade F04', () => {
    const getPlans = vi.fn();
    const duplicatePlan = vi.fn();
    const deletePlan = vi.fn();
    const setCurrentPlan = vi.fn();
    const createPlan = vi.fn();
    let facade: NutritionPlanFacade;
    let store: NutritionPlansStore;
    let context: MealPlanContextStore;
    beforeEach(() => {
        for (const mock of [getPlans, duplicatePlan, deletePlan, setCurrentPlan, createPlan])
            mock.mockReset();
        getPlans.mockReturnValue(of(nutritionPlanList([1, 2])));
        TestBed.configureTestingModule({ providers: [
                { provide: NutritionPlanApi, useValue: { getPlans, duplicatePlan, deletePlan, setCurrentPlan, createPlan } },
            ] });
        facade = TestBed.inject(NutritionPlanFacade);
        store = TestBed.inject(NutritionPlansStore);
        context = TestBed.inject(MealPlanContextStore);
    });
    it('coalesces reads, adopts list/settings and never seeds details from summaries', async () => {
        const response = new Subject<NutritionPlanListDto>();
        getPlans.mockReturnValue(response);
        const first = firstValueFrom(facade.loadList());
        const second = firstValueFrom(facade.loadList());
        expect(getPlans).toHaveBeenCalledTimes(1);
        response.next(nutritionPlanList([1, 2]));
        response.complete();
        expect(await first).toEqual(await second);
        expect(store.loaded()).toBe(true);
        expect(context.settings()?.currentNutritionPlanId).toBe(1);
        expect(TestBed.inject(NutritionPlanDetailsStore).get(1)).toBeNull();
    });
    it('preserves stale data and revision after refresh failure without retrying', async () => {
        await firstValueFrom(facade.loadList());
        const confirmed = store.plans();
        getPlans.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
        await expect(firstValueFrom(facade.loadList())).rejects.toBeTruthy();
        expect(store.plans()).toBe(confirmed);
        expect(context.revision()).toBe('8');
        expect(facade.canWrite()).toBe(false);
        expect(getPlans).toHaveBeenCalledTimes(2);
    });
    it('cancels an old-identity read and cannot repopulate a reset list', () => {
        const response = new Subject<NutritionPlanListDto>();
        getPlans.mockReturnValue(response);
        const received: NutritionPlanListDto[] = [];
        facade.loadList().subscribe(value => received.push(value));
        context.reset();
        store.reset();
        response.next(nutritionPlanList([1]));
        expect(received).toEqual([]);
        expect(store.plans()).toEqual([]);
        expect(context.revision()).toBeNull();
    });
    it('waits for the write lane before capturing a fresh list read', async () => {
        await firstValueFrom(facade.loadList());
        const response = new Subject<NutritionPlanMutationDto>();
        duplicatePlan.mockReturnValue(response);
        facade.duplicate(1, '8').subscribe();
        getPlans.mockReturnValue(of({ ...nutritionPlanList([1, 2, 3]), revision: '9' }));
        const list = firstValueFrom(facade.loadList());
        expect(getPlans).toHaveBeenCalledTimes(1);
        response.next({ ...receipt(1), plan: nutritionPlan(3) });
        response.complete();
        expect((await list).revision).toBe('9');
        expect(getPlans).toHaveBeenCalledTimes(2);
        expect(facade.canWrite()).toBe(true);
    });
    it('keeps route-exit reads alive in Core so a later entry can load normally', () => {
        const response = new Subject<NutritionPlanListDto>();
        getPlans.mockReturnValue(response);
        const subscription = facade.loadList().subscribe();
        subscription.unsubscribe();
        response.next(nutritionPlanList([1]));
        response.complete();
        expect(store.loaded()).toBe(true);
        getPlans.mockReturnValue(of(nutritionPlanList([1])));
        facade.loadList().subscribe();
        expect(getPlans).toHaveBeenCalledTimes(2);
        response.complete();
    });
    it('rejects a read captured before a write epoch', () => {
        const response = new Subject<NutritionPlanListDto>();
        getPlans.mockReturnValue(response);
        facade.loadList().subscribe();
        context.advanceReadEpoch();
        response.next(nutritionPlanList([1]));
        response.complete();
        expect(store.loaded()).toBe(false);
        expect(context.revision()).toBeNull();
        expect(store.request().status).toBe('error');
        getPlans.mockReturnValue(of(nutritionPlanList([1])));
        facade.loadList().subscribe();
        expect(store.loaded()).toBe(true);
    });
    it('switches Current only on receipt and invalidates planner projections before success', async () => {
        await firstValueFrom(facade.loadList());
        const planner = TestBed.inject(MealPlannerStore);
        const range = plannerRange('2026-10-11');
        const token = planner.beginLoad(range.from, range.through, context.readEpoch());
        TestBed.inject(MealPlanSyncService).observeRead({ kind: 'planner', token: token!, response: range });
        const response = new Subject<NutritionPlanMutationDto>();
        setCurrentPlan.mockReturnValue(response);
        const result = firstValueFrom(facade.setCurrent(2, '8'));
        expect(context.settings()?.currentNutritionPlanId).toBe(1);
        response.next(receipt(2, true));
        response.complete();
        expect((await result).outcome).toBe('confirmed');
        expect(context.settings()?.currentNutritionPlanId).toBe(2);
        expect(store.stale()).toBe(true);
        expect(setCurrentPlan).toHaveBeenCalledWith({ nutritionPlanId: 2 }, '8');
        expect(Object.values(planner.rangesByKey())[0]?.freshness).toBe('stale');
    });
    it('duplicates using the server-generated plan, stays inactive and deduplicates outstanding commands', async () => {
        await firstValueFrom(facade.loadList());
        const response = new Subject<NutritionPlanMutationDto>();
        duplicatePlan.mockReturnValue(response);
        const result = firstValueFrom(facade.duplicate(1, '8'));
        expect((await firstValueFrom(facade.duplicate(1, '8'))).outcome).toBe('duplicate');
        expect(duplicatePlan).toHaveBeenCalledTimes(1);
        response.next({ ...receipt(1), plan: { ...nutritionPlan(3), name: 'Server copy name' } });
        response.complete();
        expect((await result).outcome).toBe('confirmed');
        expect(context.settings()?.currentNutritionPlanId).toBe(1);
        expect(TestBed.inject(NutritionPlanDetailsStore).get(3)?.plan.name).toBe('Server copy name');
    });
    it('clears Current on acknowledged deletion without choosing a replacement or deleting saved food', async () => {
        await firstValueFrom(facade.loadList());
        deletePlan.mockReturnValue(of({ ...receipt(1, true), plan: null, deletedPlanId: 1,
            settings: { currentNutritionPlanId: null, currentPlan: null } }));
        expect((await firstValueFrom(facade.delete(1, '8'))).outcome).toBe('confirmed');
        expect(context.settings()?.currentNutritionPlanId).toBeNull();
        expect(deletePlan).toHaveBeenCalledWith(1, '8');
    });
    it.each([['conflict', 409], ['unknownOutcome', 0], ['unknownOutcome', 408]])('does not replay %s (%s) failures and requires fresh review', async (outcome, status) => {
        await firstValueFrom(facade.loadList());
        const confirmed = store.plans();
        duplicatePlan.mockReturnValue(throwError(() => new HttpErrorResponse({ status,
            error: { code: 'test-code', traceId: 'test-trace' } })));
        const result = await firstValueFrom(facade.duplicate(1, '8'));
        expect(result.outcome).toBe(outcome);
        expect(result.traceId).toBe('test-trace');
        expect(store.plans()).toBe(confirmed);
        expect(context.revision()).toBe('8');
        expect(duplicatePlan).toHaveBeenCalledTimes(1);
        getPlans.mockReturnValue(of({ ...nutritionPlanList([1, 2]), revision: '9' }));
        await firstValueFrom(facade.loadList());
        expect(TestBed.inject(MealPlanMutationCoordinator).paused()).toBe(true);
        expect(facade.resumeAfterReview('8')).toBe(false);
        expect(facade.resumeAfterReview('9')).toBe(true);
        expect(duplicatePlan).toHaveBeenCalledTimes(1);
    });
    function receipt(currentId: number, plannerInvalidated = false): NutritionPlanMutationDto {
        return { revision: '9', settings: nutritionPlanList([currentId]).settings,
            plan: nutritionPlan(currentId), deletedPlanId: null, profile: null, plannerInvalidated };
    }
    it('creates an Easy plan through one deduplicated command and adopts first Current before reporting success', async () => {
        getPlans.mockReturnValue(of(nutritionPlanList([])));
        await firstValueFrom(facade.loadList());
        const response = new Subject<NutritionPlanMutationDto>();
        createPlan.mockReturnValue(response);
        const request = { name: 'My Easy plan', mode: 'easy' as const, defaultMealsPerDay: 3 };
        const result = firstValueFrom(facade.create(request, '8'));
        expect((await firstValueFrom(facade.create(request, '8'))).outcome).toBe('duplicate');
        expect(createPlan).toHaveBeenCalledTimes(1);
        expect(createPlan).toHaveBeenCalledWith(request, '8');
        expect(context.settings()?.currentNutritionPlanId).toBeNull();
        const easy = { ...nutritionPlan(1), name: 'My Easy plan', mode: 'easy' as const,
            defaultMealsPerDay: 3, targets: null, calculationInputs: null, goal: null, activityLevel: null,
            calculationPolicyVersion: null, calculatedAt: null, rmrKcal: null, maintenanceKcal: null };
        response.next({ revision: '9', settings: { currentNutritionPlanId: 1, currentPlan: {
                    id: 1, name: easy.name, mode: 'easy', defaultMealsPerDay: 3, targets: null, calculationPolicyVersion: null,
                } }, plan: easy, deletedPlanId: null, profile: null, plannerInvalidated: true });
        response.complete();
        expect((await result).outcome).toBe('confirmed');
        expect(context.settings()?.currentNutritionPlanId).toBe(1);
        expect(TestBed.inject(NutritionPlanDetailsStore).get(1)?.plan.targets).toBeNull();
        expect(store.stale()).toBe(true);
    });
    it('never changes an existing Current just because another plan was created', async () => {
        await firstValueFrom(facade.loadList());
        createPlan.mockReturnValue(of({ ...receipt(1), plan: nutritionPlan(3) }));
        await firstValueFrom(facade.create({ name: 'New Easy', mode: 'easy', defaultMealsPerDay: 2 }, '8'));
        expect(context.settings()?.currentNutritionPlanId).toBe(1);
    });
});
describe('NutritionPlanFacade complete detail and editing', () => {
    const getPlan = vi.fn(), updatePlan = vi.fn();
    let facade: NutritionPlanFacade;
    beforeEach(() => {
        getPlan.mockReset();
        updatePlan.mockReset();
        TestBed.configureTestingModule({ providers: [{ provide: NutritionPlanApi, useValue: { getPlan, updatePlan } }] });
        facade = TestBed.inject(NutritionPlanFacade);
    });
    it('coalesces complete detail reads independently without inventing list summaries', async () => {
        const response = new Subject<NutritionPlanDetailDto>();
        getPlan.mockReturnValue(response);
        const first = firstValueFrom(facade.loadDetail(1));
        const second = firstValueFrom(facade.loadDetail(1));
        response.next(nutritionPlanDetail());
        response.complete();
        expect(await first).toEqual(await second);
        expect(getPlan).toHaveBeenCalledTimes(1);
        expect(facade.detail(1)?.plan.calculationInputs).toEqual(nutritionPlan().calculationInputs);
        expect(TestBed.inject(NutritionPlansStore).loaded()).toBe(false);
    });
    it('rejects a wrong-plan response without changing confirmed revision or data', async () => {
        getPlan.mockReturnValue(of(nutritionPlanDetail(2)));
        await expect(firstValueFrom(facade.loadDetail(1))).rejects.toBeTruthy();
        expect(facade.detail(1)).toBeNull();
        expect(facade.detail(2)).toBeNull();
        expect(TestBed.inject(MealPlanContextStore).revision()).toBeNull();
    });
    it('discards a pre-write detail and leaves a recoverable request rather than Loading', () => {
        const response = new Subject<NutritionPlanDetailDto>();
        getPlan.mockReturnValue(response);
        const received: NutritionPlanDetailDto[] = [];
        facade.loadDetail(1).subscribe(value => received.push(value));
        TestBed.inject(MealPlanContextStore).advanceReadEpoch();
        response.next(nutritionPlanDetail());
        expect(received).toEqual([]);
        expect(facade.detail(1)).toBeNull();
        expect(facade.detailRequest(1).status).toBe('error');
        expect(TestBed.inject(MealPlanContextStore).revision()).toBeNull();
    });
    it('applies an acknowledged metadata-only edit with saved targets intact before completing', async () => {
        getPlan.mockReturnValue(of(nutritionPlanDetail()));
        await firstValueFrom(facade.loadDetail(1));
        updatePlan.mockReturnValue(of({ revision: '9', settings: nutritionPlanList().settings,
            plan: { ...nutritionPlan(), name: 'Renamed' }, deletedPlanId: null, profile: null, plannerInvalidated: true }));
        const result = await firstValueFrom(facade.update(1, { name: 'Renamed', defaultMealsPerDay: 4 }, '8'));
        expect(result.outcome).toBe('confirmed');
        expect(updatePlan).toHaveBeenCalledWith(1, { name: 'Renamed', defaultMealsPerDay: 4 }, '8');
        expect(facade.detail(1)?.plan.targets).toEqual(nutritionPlan().targets);
        expect(facade.detail(1)?.revision).toBe('9');
    });
});

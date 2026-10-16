import { TestBed } from '@angular/core/testing';
import { MealPlannerStore, mealPlannerRangeKey } from './meal-planner.store';
import { plannerRange } from './testing/meal-plan.fixtures';
describe('MealPlannerStore', () => {
    let store: MealPlannerStore;
    beforeEach(() => {
        TestBed.configureTestingModule({});
        store = TestBed.inject(MealPlannerStore);
        store.reset();
    });
    it('keeps request and error state independent per range key', () => {
        const first = store.beginLoad('2026-10-05', '2026-10-11', 0)!;
        const second = store.beginLoad('2026-10-12', '2026-10-18', 0)!;
        expect(store.failLoad(first, 'First failed', 0)).toBe(true);
        expect(store.requestState(first.queryKey)).toEqual({ status: 'error', error: 'First failed' });
        expect(store.requestState(second.queryKey).status).toBe('loading');
    });
    it('rejects stale sequence, epoch, invalidation, and identity tokens', () => {
        const token = store.beginLoad('2026-10-05', '2026-10-11', 3)!;
        const response = plannerRange('2026-10-05', '2026-10-11');
        expect(store.acceptRange(token, response, 4)).toBe(false);
        store.invalidate(token.queryKey);
        expect(store.acceptRange(token, response, 3)).toBe(false);
        const current = store.beginLoad('2026-10-05', '2026-10-11', 3)!;
        store.reset();
        expect(store.acceptRange(current, response, 3)).toBe(false);
        expect(store.data(current.queryKey)).toBeNull();
    });
    it('preserves active and copy-review keys while evicting the unprotected LRU at max three', () => {
        const keys = [
            load('2026-10-05'),
            load('2026-10-06'),
            load('2026-10-07'),
        ];
        store.setRole('active', keys[0]!);
        store.setRole('copySource', keys[1]!);
        const fourth = store.beginLoad('2026-10-08', '2026-10-08', 0);
        expect(fourth).not.toBeNull();
        expect(store.range(keys[0]!)).not.toBeNull();
        expect(store.range(keys[1]!)).not.toBeNull();
        expect(store.range(keys[2]!)).toBeNull();
        expect(Object.keys(store.rangesByKey())).toHaveLength(3);
    });
    it('does not evict any of three protected active/source/destination contexts', () => {
        const active = load('2026-10-05');
        const source = load('2026-10-06');
        const destination = load('2026-10-07');
        store.setRole('active', active);
        store.setRole('copySource', source);
        store.setRole('copyDestination', destination);
        expect(store.beginLoad('2026-10-08', '2026-10-08', 0)).toBeNull();
        expect(Object.keys(store.rangesByKey())).toEqual(expect.arrayContaining([
            active,
            source,
            destination,
        ]));
    });
    it('retains unknown nutrition as null in the confirmed range', () => {
        const token = store.beginLoad('2026-10-05', '2026-10-05', 0)!;
        expect(store.acceptRange(token, plannerRange('2026-10-05'), 0)).toBe(true);
        const day = store.data(token.queryKey)?.days[0];
        expect(day?.totals.fatG).toBeNull();
        expect(day?.meals[0]?.items[0]?.nutrition.fatG).toBeNull();
    });
    function load(date: string): string {
        const token = store.beginLoad(date, date, 0)!;
        store.acceptRange(token, plannerRange(date), 0);
        return mealPlannerRangeKey(date, date);
    }
});

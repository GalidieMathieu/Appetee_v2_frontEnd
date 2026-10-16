import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { MealPlannerFacade } from './meal-planner.facade';
import { MealPlannerApi } from './meal-planner.api';
import { MealPlanContextStore } from './meal-plan-context.store';
import { MealPlanMutationCoordinator } from './meal-plan-mutation-coordinator';
import { plannerRange } from './testing/meal-plan.fixtures';
const source = { from: '2026-10-12', through: '2026-10-12' }, destination = { from: '2026-10-19', through: '2026-10-19' };
describe('Core copy review and atomic receipt authority', () => {
  const getRange = vi.fn(), copyDay = vi.fn(), copyWeek = vi.fn(); let facade: MealPlannerFacade;
  beforeEach(() => {
    getRange.mockReset(); copyDay.mockReset(); copyWeek.mockReset();
    getRange.mockImplementation((from: string, through: string) => {
      const result = plannerRange(from), date = new Date(from + 'T12:00:00Z'), days = [];
      while (date.toISOString().slice(0, 10) <= through) { days.push({ ...result.days[0]!, date: date.toISOString().slice(0, 10) }); date.setUTCDate(date.getUTCDate() + 1); }
      return of({ ...result, from, through, days });
    });
    TestBed.configureTestingModule({ providers: [{ provide: MealPlannerApi, useValue: { getRange, copyDay, copyWeek } }] });
    facade = TestBed.inject(MealPlannerFacade);
  });
  afterEach(() => TestBed.inject(MealPlanMutationCoordinator).reset());
  it('a newer destination cannot authorize the older source; reloads both once at a jointly reviewed version', async () => {
    getRange.mockReturnValueOnce(of(plannerRange(source.from, source.through, '8')))
      .mockReturnValueOnce(of(plannerRange(destination.from, destination.through, '9')))
      .mockReturnValueOnce(of(plannerRange(source.from, source.through, '9')))
      .mockReturnValueOnce(of(plannerRange(destination.from, destination.through, '9')));
    expect(await firstValueFrom(facade.reviewCopyRanges(source, destination))).toBe(true);
    expect(getRange).toHaveBeenCalledTimes(4); expect(facade.range(source.from + ':' + source.through)?.observedRevision).toBe('9'); expect(copyDay).not.toHaveBeenCalled();
  });
  it('bounds changing-context review without retrying mutations', async () => {
    let revision = 7; getRange.mockImplementation((from: string, through: string) => of(plannerRange(from, through, String(++revision))));
    expect(await firstValueFrom(facade.reviewCopyRanges(source, destination))).toBe(false);
    expect(getRange).toHaveBeenCalledTimes(4); expect(copyDay).not.toHaveBeenCalled();
  });
  it('does not make a virtual absent source into copied meal rows in the client', async () => {
    await firstValueFrom(facade.reviewCopyRanges(source, destination));
    const before = facade.range(destination.from + ':' + destination.through)?.data;
    const response = new Subject<any>(); copyDay.mockReturnValue(response);
    const pending = firstValueFrom(facade.copyDay({ sourceDate: source.from, destinationDate: destination.from, replaceExisting: true }, '8'));
    expect(facade.range(destination.from + ':' + destination.through)?.data).toBe(before);
    response.next({ revision: '9', settings: before!.settings, days: [{ ...before!.days[0], id: null, persistence: 'untouched', savedMealCount: 0, meals: [] }], createdMealId: null, createdItemId: null });
    expect((await pending).outcome).toBe('confirmed'); expect(facade.range(destination.from + ':' + destination.through)?.data?.days[0]?.persistence).toBe('untouched');
    expect(copyDay).toHaveBeenCalledExactlyOnceWith({ sourceDate: source.from, destinationDate: destination.from, replaceExisting: true }, '8');
  });
  it('rejects a partial seven-day receipt as unknown without partially updating confirmed destinations', async () => {
    await firstValueFrom(facade.reviewCopyRanges(source, destination)); const before = facade.range(destination.from + ':' + destination.through)?.data;
    copyWeek.mockReturnValue(of({ revision: '9', settings: before!.settings, days: before!.days, createdMealId: null, createdItemId: null }));
    const result = await firstValueFrom(facade.copyWeek({ sourceMonday: source.from, destinationMonday: destination.from, replaceExisting: true }, '8'));
    expect(result.outcome).toBe('unknownOutcome'); expect(TestBed.inject(MealPlanContextStore).revision()).toBe('8'); expect(facade.range(destination.from + ':' + destination.through)?.data).toBe(before); expect(copyWeek).toHaveBeenCalledTimes(1);
  });
  it('reset while waiting for review prevents later account reads and review publication', async () => {
    const result = firstValueFrom(facade.reviewCopyRanges(source, destination), { defaultValue: false });
    TestBed.inject(MealPlanContextStore).reset(); expect(await result).toBe(false); expect(getRange).not.toHaveBeenCalled();
  });
});

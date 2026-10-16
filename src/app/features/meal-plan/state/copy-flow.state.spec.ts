import { CopyFlowState, copyRange } from './copy-flow.state';
describe('Copy intent and review lifetime', () => {
  it.each([['2026-12-28', '2027-01-03'], ['2024-02-26', '2024-03-03'], ['2026-03-02', '2026-03-08']])('maps Monday week %s across calendar boundaries', (from, through) => { expect(copyRange(from, 'week')).toEqual({ from, through }); });
  it.each(['2026-10-13', '9999-12-27', '2026-02-30', '0999-12-30'])('rejects invalid/non-Monday/overflow week %s', date => { expect(copyRange(date, 'week')).toBeNull(); });
  it('changing destination, closing or a new review revokes old confirmation and late completions', () => {
    const state = new CopyFlowState(); state.begin('day', '2026-10-12'); const old = state.nextReview();
    state.reviewedRevision.set('8'); state.confirmed.set(true); state.setDestination('2026-10-13');
    expect(state.reviewedRevision()).toBeNull(); expect(state.confirmed()).toBe(false); expect(state.current(old)).toBe(false);
    state.clear(); expect(state.source()).toBe(''); expect(state.destination()).toBe('');
  });
});

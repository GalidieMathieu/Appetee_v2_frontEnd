import { ManualItemDraftState } from './manual-item-draft.state';
import { MANUAL_FIELDS } from '../models/manual-item-draft.model';
const valid = { name: 'Snack', caloriesKcal: '100.25', proteinG: '1', carbsG: '2.50', fatG: '.01' };
describe('Manual entry draft and strict whole-entry validation', () => {
  it.each(MANUAL_FIELDS.filter(field => field.max).flatMap(field => ['', '0', '-1', String(field.max! + 1), '1.001', 'Infinity', 'NaN', '1e1'].map(value => [field.key, value])))('rejects %s=%s without rounding or clearing the value', (field, value) => {
    const state = new ManualItemDraftState(); state.form.setValue(valid); state.form.controls[field as 'proteinG'].setValue(value);
    expect(state.value()).toBeNull(); expect(state.form.controls[field as 'proteinG'].value).toBe(value);
    expect(state.feedback(field as 'proteinG')).toContain('0.01');
  });
  it('submits only complete total-entry scalars, with no recipe quantity or calorie equality rule', () => {
    const state = new ManualItemDraftState(); state.form.setValue(valid);
    expect(state.value()).toEqual({ name: 'Snack', caloriesKcal: 100.25, proteinG: 1, carbsG: 2.5, fatG: .01 });
  });
  it('validates Unicode names, trims, rejects controls and does not truncate', () => {
    const state = new ManualItemDraftState(); state.form.setValue({ ...valid, name: '  Cafe\u0301  ' }); expect(state.value()?.name).toBe('Café');
    for (const name of ['', '\nSnack', 'x'.repeat(121), 'x\u0000']) { state.form.controls.name.setValue(name); expect(state.value()).toBeNull(); }
    state.form.controls.name.setValue('😀'.repeat(120)); expect(state.value()?.name).toBe('😀'.repeat(120));
  });
  it('copies scalars once and preserves dirty edits and originating revision after refresh', () => {
    const state = new ManualItemDraftState(), item = { id: 55, type: 'manual' as const, sortOrder: 2, name: 'Original', nutrition: { caloriesKcal: 100, proteinG: 1, carbsG: 2, fatG: 3 } };
    state.bind('date:meal:55', '8', item); state.form.controls.name.setValue('Typed'); state.form.markAsDirty();
    state.bind('date:meal:55', '9', { ...item, name: 'Other tab' });
    expect(state.form.controls.name.value).toBe('Typed'); expect(item.name).toBe('Original'); expect(state.revision()).toBe('8');
    state.errors.set({ 'manualItem.proteinG': ['Server feedback'] }); expect(state.feedback('proteinG')).toBe('Server feedback');
    state.clear(); expect(state.form.pristine).toBe(true); expect(state.key()).toBeNull();
  });
});

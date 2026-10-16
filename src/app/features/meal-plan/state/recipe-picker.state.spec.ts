import { RecipePickerState } from './recipe-picker.state';
describe('RecipePickerState', () => {
  it('keeps unsent text separate and reuses canonical normalization at submission', () => {
    const state = new RecipePickerState(); state.setSearch('  chicken   bowl  ');
    expect(state.search()).toBe('  chicken   bowl  '); expect(state.submit()).toBe('chicken bowl');
    state.savedOnly.set(true); state.clear(); expect(state.search()).toBe(''); expect(state.savedOnly()).toBe(false);
  });
});

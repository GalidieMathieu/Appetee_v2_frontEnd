import { RecipePickerStore, EMPTY_PICKER_CRITERIA } from './recipe-picker.store';
describe('RecipePickerStore', () => {
  it('rejects older criteria pages and reset-generation responses', () => {
    const store = new RecipePickerStore();
    const a = store.begin({ ...EMPTY_PICKER_CRITERIA, search: 'a' });
    const b = store.begin({ ...EMPTY_PICKER_CRITERIA, search: 'b' });
    expect(store.accept(a, { items: [], nextCursor: 'old', hasMore: true })).toBe(false);
    store.reset(); expect(store.accept(b, { items: [], nextCursor: null, hasMore: false })).toBe(false);
    expect(store.loaded()).toBe(false);
  });
  it('coalesces pagination and keeps cursor errors separate from loaded-empty', () => {
    const store = new RecipePickerStore(), token = store.begin(EMPTY_PICKER_CRITERIA);
    expect(store.loaded()).toBe(false);
    store.accept(token, { items: [], nextCursor: 'opaque', hasMore: true });
    const more = store.beginMore()!; expect(store.beginMore()).toBeNull();
    store.fail(more, 'Unavailable'); expect(store.loaded()).toBe(true); expect(store.moreError()).toBe('Unavailable'); expect(store.error()).toBeNull();
  });
});

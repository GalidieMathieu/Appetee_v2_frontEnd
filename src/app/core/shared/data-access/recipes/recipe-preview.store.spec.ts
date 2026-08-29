/**
 * Store tests for session-scoped Preview lookup, membership patching, invalidation, and reset.
 * The cache intentionally follows the shared complete-entity pattern rather than discovery state.
 */
import { RecipePreviewDto } from './recipe.model';
import { RecipePreviewStore } from './recipe-preview.store';

describe('RecipePreviewStore', () => {
  it('caches complete Preview entities independently by recipe ID', () => {
    const store = new RecipePreviewStore();
    store.upsert(preview(1));
    store.upsert(preview(2));

    expect(store.get(1)).toEqual(preview(1));
    expect(store.get(2)).toEqual(preview(2));
    expect(store.requestState(1)).toEqual({ status: 'success', error: null });
  });

  it('patches cached favorite membership without creating a partial entity', () => {
    const store = new RecipePreviewStore();
    store.upsert(preview(1));

    expect(store.updateSaved(1, true)).toBe(true);
    expect(store.get(1)?.isSaved).toBe(true);
    expect(store.updateSaved(99, true)).toBe(false);
    expect(store.get(99)).toBeNull();
  });

  it('invalidates one Preview without erasing another', () => {
    const store = new RecipePreviewStore();
    store.upsert(preview(1));
    store.upsert(preview(2));

    store.invalidate(1);

    expect(store.get(1)).toBeNull();
    expect(store.requestState(1).status).toBe('idle');
    expect(store.get(2)).toEqual(preview(2));
    expect(store.invalidationVersion(1)).toBe(1);
    expect(store.invalidationVersion(2)).toBe(0);
  });

  it('clears all identity-scoped Preview data and advances its generation on reset', () => {
    const store = new RecipePreviewStore();
    const generation = store.generation();
    store.upsert(preview(1));

    store.reset();

    expect(store.entitiesById()).toEqual({});
    expect(store.requestById()).toEqual({});
    expect(store.generation()).toBe(generation + 1);
    expect(store.invalidationVersion(1)).toBe(0);
  });
});

function preview(id: number): RecipePreviewDto {
  return {
    id,
    name: `Recipe ${id}`,
    description: 'A lightweight Preview.',
    previewImageUrl: null,
    totalTimeMinutes: 30,
    caloriesPerServing: 400,
    proteinPerServing: 20,
    estimatedCostPerServing: 3.5,
    badges: ['Quick Meal'],
    ingredients: [{ id: 10 + id, name: 'Ingredient' }],
    isSaved: false,
  };
}

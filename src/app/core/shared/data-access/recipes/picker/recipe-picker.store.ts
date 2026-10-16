import { Injectable, computed, signal } from '@angular/core';
import { RecipeCardAdvance, RecipeDiscoveryCriteria, RecipeMealPlanPageDto } from '../recipe.model';

export interface PickerRequestToken { readonly generation: number; readonly cursor: string | null; }
interface PickerState {
  readonly generation: number;
  readonly criteria: RecipeDiscoveryCriteria;
  readonly cards: readonly RecipeCardAdvance[];
  readonly cursor: string | null;
  readonly hasMore: boolean;
  readonly loaded: boolean;
  readonly stale: boolean;
  readonly loading: boolean;
  readonly loadingMore: boolean;
  readonly error: string | null;
  readonly moreError: string | null;
}
export const EMPTY_PICKER_CRITERIA: RecipeDiscoveryCriteria = {
  search: '', savedOnly: false, ingredientIds: [], requireAllIngredients: true, badges: [],
  maxTotalMinutes: null, maxDifficulty: null,
};
const initial = (generation = 0): PickerState => ({
  generation, criteria: EMPTY_PICKER_CRITERIA, cards: [], cursor: null, hasMore: false,
  loaded: false, stale: false, loading: false, loadingMore: false, error: null, moreError: null,
});

/** Workspace-scoped Core query projection, never shared with RecipesStore. */
@Injectable()
export class RecipePickerStore {
  private readonly data = signal<PickerState>(initial());
  readonly state = this.data.asReadonly();
  readonly cards = computed(() => this.data().cards);
  readonly criteria = computed(() => this.data().criteria);
  readonly loading = computed(() => this.data().loading);
  readonly loadingMore = computed(() => this.data().loadingMore);
  readonly loaded = computed(() => this.data().loaded);
  readonly stale = computed(() => this.data().stale);
  readonly error = computed(() => this.data().error);
  readonly moreError = computed(() => this.data().moreError);
  readonly hasMore = computed(() => this.data().hasMore);

  begin(criteria: RecipeDiscoveryCriteria): PickerRequestToken {
    const old = this.data(), same = JSON.stringify(old.criteria) === JSON.stringify(criteria);
    const generation = old.generation + 1;
    this.data.set({ ...initial(generation), criteria, cards: same ? old.cards : [],
      loaded: same && old.loaded, stale: same && old.loaded, loading: true });
    return { generation, cursor: null };
  }
  beginMore(): PickerRequestToken | null {
    const state = this.data();
    if (state.loading || state.loadingMore || state.stale || !state.hasMore || !state.cursor) return null;
    this.data.update(value => ({ ...value, loadingMore: true, moreError: null }));
    return { generation: state.generation, cursor: state.cursor };
  }
  current(token: PickerRequestToken): boolean {
    const state = this.data();
    return state.generation === token.generation && (token.cursor === null ? state.loading : state.loadingMore && state.cursor === token.cursor);
  }
  accept(token: PickerRequestToken, page: RecipeMealPlanPageDto): boolean {
    if (!this.current(token)) return false;
    this.data.update(state => {
      const cards = token.cursor === null ? [] : [...state.cards];
      const ids = new Set(cards.map(card => card.id));
      for (const card of page.items) if (!ids.has(card.id)) { cards.push(card); ids.add(card.id); }
      return { ...state, cards, cursor: page.nextCursor, hasMore: page.hasMore && page.nextCursor !== null,
        loaded: true, stale: false, loading: false, loadingMore: false, error: null, moreError: null };
    });
    return true;
  }
  fail(token: PickerRequestToken, error: string): void {
    if (!this.current(token)) return;
    this.data.update(state => ({ ...state, loading: false, loadingMore: false,
      ...(token.cursor === null ? { error } : { moreError: error }) }));
  }
  reset(): void { this.data.set(initial(this.data().generation + 1)); }
}

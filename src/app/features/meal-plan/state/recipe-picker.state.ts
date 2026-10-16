import { Injectable, signal } from '@angular/core';
import { normalizeRecipeSearchValue } from '@app/core/shared/data-access/recipes/recipe-search';
/** Only unsubmitted UI text and tab intent; applied criteria/results belong to Core. */
@Injectable()
export class RecipePickerState {
  readonly search = signal('');
  readonly savedOnly = signal(false);
  setSearch(value: string): void { this.search.set(value); }
  submit(): string { const search = normalizeRecipeSearchValue(this.search()); this.search.set(search); return search; }
  clear(): void { this.search.set(''); this.savedOnly.set(false); }
}

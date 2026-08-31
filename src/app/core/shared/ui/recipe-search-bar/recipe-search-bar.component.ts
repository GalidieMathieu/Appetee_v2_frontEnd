/**
 * Reusable recipe search controls extracted from Recipe Discovery's canonical implementation.
 * The component normalizes and emits intent while callers retain routing, HTTP, and filter state.
 */
import { Component, effect, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { RECIPE_SEARCH_MAX_LENGTH, normalizeRecipeSearchValue } from './recipe-search';

@Component({
  selector: 'app-recipe-search-bar',
  standalone: true,
  imports: [MatIconModule, ReactiveFormsModule],
  templateUrl: './recipe-search-bar.component.html',
  styleUrl: './recipe-search-bar.component.scss',
})
export class RecipeSearchBarComponent {
  readonly value = input('');
  readonly placeholder = input('Search recipes or ingredients...');
  readonly searchSubmitted = output<string>();

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly maxLength = RECIPE_SEARCH_MAX_LENGTH;

  constructor() {
    effect(() => {
      this.searchControl.setValue(this.value(), { emitEvent: false });
    });
  }

  /** Normalizes once at the shared boundary so every consumer receives identical search intent. */
  protected submit(event: Event): void {
    event.preventDefault();
    const normalized = normalizeRecipeSearchValue(this.searchControl.value);
    this.searchControl.setValue(normalized, { emitEvent: false });
    this.searchSubmitted.emit(normalized);
  }
}

/**
 * Recipe-filter ingredient autocomplete owns bounded suggestion requests and combobox interaction.
 * Selected ingredient identity is supplied by its parent so query text and stale responses cannot
 * replace the current applied/draft selection.
 */
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { EMPTY, Subject, catchError, map, merge, of, switchMap, tap, timer } from 'rxjs';

import { IngredientsApi } from '@app/core/shared/data-access/ingredients/ingredient.api';
import { Ingredient } from '@app/core/shared/data-access/ingredients/ingredient.model';

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;
const SUGGESTION_LIMIT = 10;
const SELECTION_LIMIT = 3;

type SuggestionStatus = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-ingredient-autocomplete',
  standalone: true,
  imports: [MatIconModule, ReactiveFormsModule],
  templateUrl: './ingredient-autocomplete.component.html',
  styleUrl: './ingredient-autocomplete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IngredientAutocompleteComponent {
  private readonly api = inject(IngredientsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly retryRequests = new Subject<string>();
  private readonly rawSuggestions = signal<readonly Ingredient[]>([]);

  readonly selectedIngredients = input<readonly Ingredient[]>([]);
  readonly selectedIngredientsChange = output<readonly Ingredient[]>();

  protected readonly queryControl = new FormControl('', { nonNullable: true });
  protected readonly status = signal<SuggestionStatus>('idle');
  protected readonly activeIndex = signal(-1);
  protected readonly selectionLimitReached = computed(
    () => this.selectedIngredients().length >= SELECTION_LIMIT
  );
  protected readonly suggestions = computed(() => {
    const selectedIds = new Set(this.selectedIngredients().map(ingredient => ingredient.id));
    return this.rawSuggestions().filter(ingredient => !selectedIds.has(ingredient.id));
  });
  protected readonly panelVisible = computed(
    () => !this.selectionLimitReached() && this.status() !== 'idle'
  );
  protected readonly activeOptionId = computed(() => {
    const index = this.activeIndex();
    return index < 0 ? null : `ingredient-suggestion-${index}`;
  });

  constructor() {
    const typedQueries = this.queryControl.valueChanges.pipe(
      map(query => ({ query, delay: SEARCH_DEBOUNCE_MS }))
    );
    const retriedQueries = this.retryRequests.pipe(
      map(query => ({ query, delay: 0 }))
    );

    // switchMap cancels both a pending debounce and an older HTTP subscription on every query.
    merge(typedQueries, retriedQueries).pipe(
      switchMap(request => this.requestSuggestions(request.query, request.delay)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(suggestions => {
      this.rawSuggestions.set(suggestions.slice(0, SUGGESTION_LIMIT));
      this.activeIndex.set(-1);
      this.status.set('success');
    });
  }

  protected selectIngredient(ingredient: Ingredient): void {
    if (
      this.selectionLimitReached()
      || this.selectedIngredients().some(selected => selected.id === ingredient.id)
    ) {
      return;
    }

    this.selectedIngredientsChange.emit([...this.selectedIngredients(), ingredient]);
    this.queryControl.setValue('');
  }

  protected removeIngredient(ingredientId: number): void {
    this.selectedIngredientsChange.emit(
      this.selectedIngredients().filter(ingredient => ingredient.id !== ingredientId)
    );
  }

  /** Supports listbox navigation without moving DOM focus away from the combobox input. */
  protected onInputKeydown(event: KeyboardEvent): void {
    const suggestions = this.suggestions();
    if (!this.panelVisible() || suggestions.length === 0) {
      if (event.key === 'Escape') this.closeSuggestions();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const current = this.activeIndex();
      this.activeIndex.set(
        current < 0
          ? (direction > 0 ? 0 : suggestions.length - 1)
          : (current + direction + suggestions.length) % suggestions.length
      );
      return;
    }

    if (event.key === 'Enter' && this.activeIndex() >= 0) {
      event.preventDefault();
      this.selectIngredient(suggestions[this.activeIndex()]);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSuggestions();
    }
  }

  protected retry(): void {
    this.retryRequests.next(this.queryControl.value.trim());
  }

  private closeSuggestions(): void {
    this.rawSuggestions.set([]);
    this.activeIndex.set(-1);
    this.status.set('idle');
  }

  /** Normalizes, debounces, and bounds one request while converting failures into local UI state. */
  private requestSuggestions(query: string, delay: number) {
    const normalized = query.trim();
    this.closeSuggestions();
    if (normalized.length < MIN_QUERY_LENGTH || this.selectionLimitReached()) return EMPTY;

    return timer(delay).pipe(
      tap(() => this.status.set('loading')),
      switchMap(() => this.api.search(normalized, SUGGESTION_LIMIT)),
      catchError(() => {
        this.status.set('error');
        return EMPTY;
      })
    );
  }
}

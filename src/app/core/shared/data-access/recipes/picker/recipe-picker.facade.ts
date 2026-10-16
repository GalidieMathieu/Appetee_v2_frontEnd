import { DestroyRef, Injectable, OnDestroy, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, takeUntil, timeout } from 'rxjs';
import { RecipesApi } from '../recipe.api';
import { RecipesFacade } from '../recipe.facade';
import { MealPlanContextStore } from '../../meal-plan/meal-plan-context.store';
import { toApiErrorMessage } from '../../generic-template/api-error-message';
import { normalizeRecipeSearchValue } from '../recipe-search';
import { EMPTY_PICKER_CRITERIA, PickerRequestToken, RecipePickerStore } from './recipe-picker.store';

@Injectable()
export class RecipePickerFacade implements OnDestroy {
  private readonly api = inject(RecipesApi);
  private readonly store = inject(RecipePickerStore);
  private readonly recipes = inject(RecipesFacade);
  private readonly context = inject(MealPlanContextStore);
  private readonly destroy = inject(DestroyRef);
  private readonly cancel$ = new Subject<void>();
  private initialized = false;
  readonly cards = this.store.cards;
  readonly criteria = this.store.criteria;
  readonly loaded = this.store.loaded;
  readonly loading = this.store.loading;
  readonly loadingMore = this.store.loadingMore;
  readonly stale = this.store.stale;
  readonly error = this.store.error;
  readonly moreError = this.store.moreError;
  readonly hasMore = this.store.hasMore;
  constructor() {
    this.context.reset$.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => this.clear());
    this.recipes.queryInvalidated$.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      if (this.initialized) this.refresh();
    });
    this.recipes.favoriteChanged$.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      if (this.initialized && this.criteria().savedOnly) this.refresh();
    });
  }
  apply(search: string, savedOnly: boolean): void {
    const criteria = { ...EMPTY_PICKER_CRITERIA, search: normalizeRecipeSearchValue(search), savedOnly };
    if (this.initialized && JSON.stringify(criteria) === JSON.stringify(this.criteria())
      && !this.stale() && (this.loaded() || this.loading())) return;
    this.initialized = true;
    this.cancel$.next();
    this.load(this.store.begin(criteria));
  }
  refresh(): void {
    if (!this.initialized) return;
    this.cancel$.next();
    this.load(this.store.begin(this.criteria()));
  }
  more(): void { const token = this.store.beginMore(); if (token) this.load(token); }
  private load(token: PickerRequestToken): void {
    this.api.discoverForMealPlan(this.criteria(), token.cursor).pipe(
      timeout(10000), takeUntil(this.cancel$), takeUntilDestroyed(this.destroy),
    ).subscribe({
      next: page => this.store.accept(token, page),
      error: error => {
        if (!this.store.current(token)) return;
        if (token.cursor !== null && error?.status === 400) { this.refresh(); return; }
        this.store.fail(token, error?.status === 404 || error?.status === 503
          ? 'The recipe picker service is unavailable. Try again when the backend is available.'
          : toApiErrorMessage(error));
      },
    });
  }
  clear(): void { this.cancel$.next(); this.store.reset(); this.initialized = false; }
  ngOnDestroy(): void { this.clear(); this.cancel$.complete(); }
}

/**
 * Recipe Discovery page controller for canonical URL criteria, responsive filter drafts, and cards.
 * Shared Recipe Cards now own Preview/favorite interaction; this page remains discovery-only.
 */
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';

import { IngredientsFacade } from '@app/core/shared/data-access/ingredients/ingredient.facade';
import { Ingredient } from '@app/core/shared/data-access/ingredients/ingredient.model';
import {
  RecipeBadge,
  RecipeDiscoveryCriteria,
  RecipeMaximumDifficulty,
} from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipeCardGridComponent } from '@app/core/shared/ui/recipe-card-grid/recipe-card-grid.component';
import { RecipeSearchBarComponent } from '@app/core/shared/ui/recipe-search-bar/recipe-search-bar.component';
import { IngredientAutocompleteComponent } from './ingredient-autocomplete.component';
import { RecipeDiscoveryFacade } from '../state/recipe-discovery.facade';
import {
  RECIPE_BADGE_OPTIONS,
  RECIPE_MAX_DIFFICULTY_OPTIONS,
  RECIPE_MAX_TOTAL_MINUTES_OPTIONS,
  parseRequireAllIngredients,
  parseSavedOnly,
  recipeDiscoveryCriteria,
  recipeDiscoveryQueryParams,
} from '../state/recipe-discovery-search';

@Component({
  selector: 'app-recipes-list',
  templateUrl: './recipesList.page.html',
  styleUrls: ['./recipesList.page.scss'],
  standalone: true,
  imports: [
    CdkTrapFocus,
    IngredientAutocompleteComponent,
    MatIconModule,
    RecipeCardGridComponent,
    RecipeSearchBarComponent,
  ],
})
export class RecipesListComponent implements OnInit, OnDestroy {
  private readonly discoveryFacade = inject(RecipeDiscoveryFacade);
  private readonly ingredientsFacade = inject(IngredientsFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private loadMoreObserver: IntersectionObserver | null = null;
  private previousBodyOverflow: string | null = null;

  protected readonly recipes = this.discoveryFacade.cards;
  protected readonly appliedSearch = this.discoveryFacade.appliedSearch;
  protected readonly appliedIngredientIds = this.discoveryFacade.appliedIngredientIds;
  protected readonly appliedRequireAllIngredients =
    this.discoveryFacade.appliedRequireAllIngredients;
  protected readonly appliedBadges = this.discoveryFacade.appliedBadges;
  protected readonly appliedMaxTotalMinutes =
    this.discoveryFacade.appliedMaxTotalMinutes;
  protected readonly appliedMaxDifficulty = this.discoveryFacade.appliedMaxDifficulty;
  protected readonly appliedSavedOnly = this.discoveryFacade.appliedSavedOnly;
  protected readonly hasAppliedAdvancedFilters =
    this.discoveryFacade.hasAppliedAdvancedFilters;
  protected readonly hasMore = this.discoveryFacade.hasMore;
  protected readonly isInitialLoading = this.discoveryFacade.isInitialLoading;
  protected readonly initialError = this.discoveryFacade.initialError;
  protected readonly isLoadingMore = this.discoveryFacade.isLoadingMore;
  protected readonly loadMoreError = this.discoveryFacade.loadMoreError;
  protected readonly badgeOptions = RECIPE_BADGE_OPTIONS;
  protected readonly maxTotalMinutesOptions = RECIPE_MAX_TOTAL_MINUTES_OPTIONS;
  protected readonly maxDifficultyOptions = RECIPE_MAX_DIFFICULTY_OPTIONS;
  protected readonly filtersExpanded = signal(false);
  protected readonly mobileFiltersActive = signal(false);
  protected readonly draftIngredients = signal<readonly Ingredient[]>([]);
  protected readonly draftRequireAllIngredients = signal(true);
  private readonly knownIngredientNames = signal<Readonly<Record<number, string>>>({});
  protected readonly draftBadges = signal<readonly RecipeBadge[]>([]);
  protected readonly draftMaxTotalMinutes = signal<number | null>(null);
  protected readonly draftMaxDifficulty = signal<RecipeMaximumDifficulty | null>(null);
  protected readonly draftSavedOnly = signal(false);
  protected readonly appliedIngredients = computed<readonly Ingredient[]>(() =>
    this.ingredientsForIds(this.appliedIngredientIds())
  );
  protected readonly appliedFilterCount = computed(
    () => this.appliedIngredientIds().length
      + this.appliedBadges().length
      + (this.appliedMaxTotalMinutes() === null ? 0 : 1)
      + (this.appliedMaxDifficulty() === null ? 0 : 1)
      + (this.appliedSavedOnly() ? 1 : 0)
  );
  protected readonly hasVisibleAppliedFilters = computed(
    () => this.appliedIngredientIds().length > 0
      || this.appliedBadges().length > 0
      || this.appliedSavedOnly()
  );

  @ViewChild('filtersTrigger')
  private filtersTrigger: ElementRef<HTMLButtonElement> | undefined;

  /** Rebinds the browser-only continuation observer as the sentinel enters/leaves the view. */
  @ViewChild('loadMoreSentinel')
  set loadMoreSentinel(element: ElementRef<HTMLElement> | undefined) {
    this.loadMoreObserver?.disconnect();
    this.loadMoreObserver = null;

    if (
      !element
      || !isPlatformBrowser(this.platformId)
      || typeof IntersectionObserver === 'undefined'
    ) {
      return;
    }

    this.loadMoreObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        this.discoveryFacade.loadNextPage();
      }
    }, { rootMargin: '240px 0px' });
    this.loadMoreObserver.observe(element.nativeElement);
  }

  /** Restores applied URL intent and replaces malformed/default parameters canonically. */
  ngOnInit(): void {
    // The URL intentionally stores IDs only; the shared catalogue restores names after refresh.
    this.ingredientsFacade.ingredients$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ingredients => this.rememberIngredientNames(ingredients));

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const rawSearch = params.get('search');
        const rawIngredientIds = params.getAll('ingredientIds');
        const rawRequireAllIngredients = params.get('requireAllIngredients');
        const rawSavedOnly = params.get('savedOnly');
        const rawBadges = params.getAll('badges');
        const rawMaxTotalMinutes = params.get('maxTotalMinutes');
        const rawMaxDifficulty = params.get('maxDifficulty');
        const criteria = recipeDiscoveryCriteria({
          search: rawSearch,
          ingredientIds: rawIngredientIds,
          requireAllIngredients: parseRequireAllIngredients(rawRequireAllIngredients),
          badges: rawBadges,
          maxTotalMinutes: rawMaxTotalMinutes,
          maxDifficulty: rawMaxDifficulty,
          savedOnly: parseSavedOnly(rawSavedOnly),
        });

        if (criteria.ingredientIds.length > 0) this.ingredientsFacade.loadIfNeeded();
        this.discoveryFacade.initializeFromUrl(criteria);
        if (!this.filtersExpanded()) this.syncDraftFrom(criteria);

        if (
          params.has('cursor')
          || params.has('seed')
          || (rawSearch ?? '') !== criteria.search
          || !this.sameValues(
            rawIngredientIds,
            criteria.ingredientIds.map(String)
          )
          || rawRequireAllIngredients !== (
            criteria.ingredientIds.length > 0 && !criteria.requireAllIngredients
              ? 'false'
              : null
          )
          || (rawSavedOnly !== null && rawSavedOnly !== 'true')
          || !this.sameValues(rawBadges, criteria.badges)
          || rawMaxTotalMinutes !== this.canonicalNumber(criteria.maxTotalMinutes)
          || rawMaxDifficulty !== criteria.maxDifficulty
        ) {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: recipeDiscoveryQueryParams(criteria),
            replaceUrl: true,
          });
        }
      });
  }

  ngOnDestroy(): void {
    this.loadMoreObserver?.disconnect();
    this.restorePageScroll();
  }

  protected retryInitial(): void {
    this.discoveryFacade.retryInitial();
  }

  protected loadNextPage(): void {
    this.discoveryFacade.loadNextPage();
  }

  protected retryLoadMore(): void {
    this.discoveryFacade.retryLoadMore();
  }

  /** Commits shared normalized search while preserving every applied advanced filter. */
  protected submitSearch(normalizedSearch: string): void {
    if (normalizedSearch === this.appliedSearch()) return;

    this.navigateToCriteria(this.currentAppliedCriteria(normalizedSearch));
  }

  /** Opens from an applied-state clone or closes while discarding uncommitted draft edits. */
  protected toggleFilters(): void {
    if (this.filtersExpanded()) {
      this.syncDraftFrom(this.currentAppliedCriteria());
      this.collapseFilters();
      return;
    }

    this.syncDraftFrom(this.currentAppliedCriteria());
    const mobile = this.isMobileViewport();
    this.mobileFiltersActive.set(mobile);
    if (mobile) this.lockPageScroll();
    this.filtersExpanded.set(true);
  }

  protected isDraftBadgeSelected(badge: RecipeBadge): boolean {
    return this.draftBadges().includes(badge);
  }

  /** Toggles draft membership while retaining the documented canonical badge order. */
  protected toggleDraftBadge(badge: RecipeBadge): void {
    this.draftBadges.update(selected => selected.includes(badge)
      ? selected.filter(value => value !== badge)
      : this.badgeOptions.filter(value => [...selected, badge].includes(value))
    );
  }

  /** Maps the six visual slider stops to null/15/30/45/60/90 criteria values. */
  protected draftMaxTotalMinutesIndex(): number {
    const minutes = this.draftMaxTotalMinutes();
    return minutes === null
      ? 0
      : this.maxTotalMinutesOptions.findIndex(option => option === minutes) + 1;
  }

  protected draftMaxTotalMinutesLabel(): string {
    const minutes = this.draftMaxTotalMinutes();
    return minutes === null ? 'Any' : minutes === 90 ? '90 min+' : `${minutes} min`;
  }

  protected updateDraftMaxTotalMinutes(event: Event): void {
    const index = Number((event.target as HTMLInputElement).value);
    this.draftMaxTotalMinutes.set(index === 0
      ? null
      : this.maxTotalMinutesOptions[index - 1] ?? null
    );
  }

  /** Uses Hard as the unrestricted final slider stop, so it serializes as no maximum. */
  protected draftMaxDifficultyIndex(): number {
    const difficulty = this.draftMaxDifficulty();
    return difficulty === null ? 2 : this.maxDifficultyOptions.indexOf(difficulty);
  }

  protected draftMaxDifficultyLabel(): string {
    return this.draftMaxDifficulty() ?? 'Hard';
  }

  protected updateDraftMaxDifficulty(event: Event): void {
    const index = Number((event.target as HTMLInputElement).value);
    this.draftMaxDifficulty.set(this.maxDifficultyOptions[index] ?? null);
  }

  protected toggleDraftSavedOnly(): void {
    this.draftSavedOnly.update(value => !value);
  }

  protected clearDraftFilters(): void {
    this.draftIngredients.set([]);
    this.draftRequireAllIngredients.set(true);
    this.draftBadges.set([]);
    this.draftMaxTotalMinutes.set(null);
    this.draftMaxDifficulty.set(null);
    this.draftSavedOnly.set(false);
  }

  /** De-duplicates IDs defensively while retaining names only as local display metadata. */
  protected updateDraftIngredients(ingredients: readonly Ingredient[]): void {
    const unique = new Map<number, Ingredient>();
    for (const ingredient of ingredients) {
      if (Number.isSafeInteger(ingredient.id) && ingredient.id > 0) {
        unique.set(ingredient.id, ingredient);
      }
      if (unique.size === 3) break;
    }
    const normalized = [...unique.values()];
    this.draftIngredients.set(normalized);
    this.knownIngredientNames.update(names => ({
      ...names,
      ...Object.fromEntries(normalized.map(ingredient => [ingredient.id, ingredient.name])),
    }));
  }

  protected toggleDraftRequireAllIngredients(): void {
    this.draftRequireAllIngredients.update(value => !value);
  }

  /** Commits the entire advanced-filter draft through one router navigation. */
  protected applyFilters(): void {
    const criteria = recipeDiscoveryCriteria({
      search: this.appliedSearch(),
      ingredientIds: this.draftIngredients().map(ingredient => ingredient.id),
      requireAllIngredients: this.draftRequireAllIngredients(),
      badges: this.draftBadges(),
      maxTotalMinutes: this.draftMaxTotalMinutes(),
      maxDifficulty: this.draftMaxDifficulty(),
      savedOnly: this.draftSavedOnly(),
    });
    this.collapseFilters();
    this.navigateToCriteria(criteria);
  }

  protected removeAppliedBadge(badge: RecipeBadge): void {
    this.navigateToCriteria(recipeDiscoveryCriteria({
      ...this.currentAppliedCriteria(),
      badges: this.appliedBadges().filter(value => value !== badge),
    }));
  }

  protected removeAppliedIngredient(ingredientId: number): void {
    this.navigateToCriteria(recipeDiscoveryCriteria({
      ...this.currentAppliedCriteria(),
      ingredientIds: this.appliedIngredientIds().filter(id => id !== ingredientId),
    }));
  }

  protected toggleSavedOnly(): void {
    this.navigateToCriteria(recipeDiscoveryCriteria({
      ...this.currentAppliedCriteria(),
      savedOnly: !this.appliedSavedOnly(),
    }));
  }

  protected clearAllAppliedFilters(): void {
    this.navigateToCriteria(recipeDiscoveryCriteria({ search: this.appliedSearch() }));
  }

  /** Reconstructs canonical applied intent from store signals for partial committed actions. */
  private currentAppliedCriteria(search = this.appliedSearch()): RecipeDiscoveryCriteria {
    return recipeDiscoveryCriteria({
      search,
      ingredientIds: this.appliedIngredientIds(),
      requireAllIngredients: this.appliedRequireAllIngredients(),
      badges: this.appliedBadges(),
      maxTotalMinutes: this.appliedMaxTotalMinutes(),
      maxDifficulty: this.appliedMaxDifficulty(),
      savedOnly: this.appliedSavedOnly(),
    });
  }

  /** Clones applied values so draft edits cannot mutate persistent discovery state. */
  private syncDraftFrom(criteria: RecipeDiscoveryCriteria): void {
    this.draftIngredients.set(this.ingredientsForIds(criteria.ingredientIds));
    this.draftRequireAllIngredients.set(criteria.requireAllIngredients);
    this.draftBadges.set([...criteria.badges]);
    this.draftMaxTotalMinutes.set(criteria.maxTotalMinutes);
    this.draftMaxDifficulty.set(criteria.maxDifficulty);
    this.draftSavedOnly.set(criteria.savedOnly);
  }

  /** Writes applied criteria to the URL; the route subscription owns the resulting reload. */
  private navigateToCriteria(criteria: RecipeDiscoveryCriteria): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: recipeDiscoveryQueryParams(criteria),
    });
  }

  /** Collapses either presentation, restores page scrolling, and returns focus to its trigger. */
  private collapseFilters(): void {
    this.filtersExpanded.set(false);
    this.mobileFiltersActive.set(false);
    this.restorePageScroll();
    if (!isPlatformBrowser(this.platformId)) return;

    queueMicrotask(() => this.filtersTrigger?.nativeElement.focus());
  }

  /** Uses the same CSS breakpoint to decide when filter controls become a modal experience. */
  private isMobileViewport(): boolean {
    return isPlatformBrowser(this.platformId)
      && this.document.defaultView?.matchMedia?.('(max-width: 639px)').matches === true;
  }

  /** Prevents the recipe list behind the full-screen mobile filter from scrolling. */
  private lockPageScroll(): void {
    if (this.previousBodyOverflow !== null) return;
    this.previousBodyOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
  }

  /** Restores the exact inline overflow value that existed before opening mobile filters. */
  private restorePageScroll(): void {
    if (this.previousBodyOverflow === null) return;
    this.document.body.style.overflow = this.previousBodyOverflow;
    this.previousBodyOverflow = null;
  }

  /** Detects invalid, duplicate, or noncanonical repeated URL values before replacement. */
  private sameValues(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length
      && left.every((value, index) => value === right[index]);
  }

  private canonicalNumber(value: number | null): string | null {
    return value === null ? null : String(value);
  }

  /** Resolves transient display names without expanding canonical criteria beyond ingredient IDs. */
  private ingredientsForIds(ids: readonly number[]): readonly Ingredient[] {
    const names = this.knownIngredientNames();
    return ids.map(id => ({ id, name: names[id] ?? 'Loading ingredient…' }));
  }

  /** Hydrates URL-restored IDs from the shared catalogue and refreshes any open draft chips. */
  private rememberIngredientNames(ingredients: readonly Ingredient[]): void {
    if (ingredients.length === 0) return;
    const catalogueNames = Object.fromEntries(
      ingredients.map(ingredient => [ingredient.id, ingredient.name])
    );
    this.knownIngredientNames.update(names => ({ ...names, ...catalogueNames }));
    this.draftIngredients.update(selected => selected.map(ingredient => ({
      ...ingredient,
      name: catalogueNames[ingredient.id] ?? ingredient.name,
    })));
  }
}

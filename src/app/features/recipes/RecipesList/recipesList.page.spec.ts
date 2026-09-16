/**
 * Page-level coverage for discovery rendering, URL behavior, paging, and shared Card composition.
 * Interaction assertions verify the Card works without feature-owned output bindings.
 */
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';

import { IngredientsApi } from '@app/core/shared/data-access/ingredients/ingredient.api';
import { IngredientsFacade } from '@app/core/shared/data-access/ingredients/ingredient.facade';
import {
  RecipeBadge,
  RecipeCardDto,
  RecipeDiscoveryCriteria,
  RecipeMaximumDifficulty,
} from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipeExperienceFacade } from '@app/core/shared/ui/recipe-experience/recipe-experience.facade';
import { RecipeDiscoveryFacade } from '../state/recipe-discovery.facade';
import { RecipeDiscoveryQueryParams } from '../state/recipe-discovery-search';

import { IngredientAutocompleteComponent } from './ingredient-autocomplete.component';
import { RecipesListComponent } from './recipesList.page';

describe('RecipesListComponent', () => {
  const cards = signal<readonly RecipeCardDto[]>([]);
  const appliedSearch = signal('');
  const appliedIngredientIds = signal<readonly number[]>([]);
  const appliedRequireAllIngredients = signal(true);
  const appliedBadges = signal<readonly RecipeBadge[]>([]);
  const appliedMaxTotalMinutes = signal<number | null>(null);
  const appliedMaxDifficulty = signal<RecipeMaximumDifficulty | null>(null);
  const appliedSavedOnly = signal(false);
  const hasAppliedAdvancedFilters = signal(false);
  const hasMore = signal(false);
  const isInitialLoading = signal(false);
  const initialError = signal<string | null>(null);
  const isLoadingMore = signal(false);
  const loadMoreError = signal<string | null>(null);
  const favoriteFeedback = signal<{ recipeId: number; message: string } | null>(null);
  const initializeFromUrl = vi.fn();
  const retryInitial = vi.fn();
  const loadNextPage = vi.fn();
  const retryLoadMore = vi.fn();
  const isFavoritePending = vi.fn();
  const toggleFavorite = vi.fn();
  const openPreview = vi.fn();
  const loadIngredientsIfNeeded = vi.fn();
  const navigate = vi.fn();
  const queryParamMap = new BehaviorSubject(convertToParamMap({}));
  const activatedRoute = { queryParamMap: queryParamMap.asObservable() };

  beforeEach(async () => {
    cards.set([]);
    appliedSearch.set('');
    appliedIngredientIds.set([]);
    appliedRequireAllIngredients.set(true);
    appliedBadges.set([]);
    appliedMaxTotalMinutes.set(null);
    appliedMaxDifficulty.set(null);
    appliedSavedOnly.set(false);
    hasAppliedAdvancedFilters.set(false);
    hasMore.set(false);
    isInitialLoading.set(false);
    initialError.set(null);
    isLoadingMore.set(false);
    loadMoreError.set(null);
    favoriteFeedback.set(null);
    initializeFromUrl.mockReset();
    initializeFromUrl.mockImplementation((criteria: RecipeDiscoveryCriteria) => {
      appliedSearch.set(criteria.search);
      appliedIngredientIds.set(criteria.ingredientIds);
      appliedRequireAllIngredients.set(criteria.requireAllIngredients);
      appliedBadges.set(criteria.badges);
      appliedMaxTotalMinutes.set(criteria.maxTotalMinutes);
      appliedMaxDifficulty.set(criteria.maxDifficulty);
      appliedSavedOnly.set(criteria.savedOnly);
      hasAppliedAdvancedFilters.set(
        criteria.ingredientIds.length > 0
        || criteria.badges.length > 0
        || criteria.maxTotalMinutes !== null
        || criteria.maxDifficulty !== null
        || criteria.savedOnly
      );
    });
    retryInitial.mockReset();
    loadNextPage.mockReset();
    retryLoadMore.mockReset();
    isFavoritePending.mockReset();
    isFavoritePending.mockReturnValue(false);
    toggleFavorite.mockReset();
    openPreview.mockReset();
    loadIngredientsIfNeeded.mockReset();
    navigate.mockReset();
    navigate.mockResolvedValue(true);
    queryParamMap.next(convertToParamMap({}));
    FakeIntersectionObserver.latest = null;
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    vi.stubGlobal('matchMedia', createMatchMedia(false));
    document.body.style.overflow = '';

    TestBed.configureTestingModule({
      imports: [RecipesListComponent],
      providers: [
        {
          provide: RecipeDiscoveryFacade,
          useValue: {
            cards,
            appliedSearch,
            appliedIngredientIds,
            appliedRequireAllIngredients,
            appliedBadges,
            appliedMaxTotalMinutes,
            appliedMaxDifficulty,
            appliedSavedOnly,
            hasAppliedAdvancedFilters,
            hasMore,
            isInitialLoading,
            initialError,
            isLoadingMore,
            loadMoreError,
            initializeFromUrl,
            retryInitial,
            loadNextPage,
            retryLoadMore,
          },
        },
        { provide: ActivatedRoute, useValue: activatedRoute },
        { provide: Router, useValue: { navigate } },
        {
          provide: RecipeExperienceFacade,
          useValue: {
            openPreview,
            toggleFavorite,
            favoriteSavedState: (_recipeId: number, fallback: boolean) => fallback,
            isFavoritePending,
            favoriteFeedbackFor: (recipeId: number) => {
              const feedback = favoriteFeedback();
              return feedback?.recipeId === recipeId ? feedback.message : null;
            },
          },
        },
        { provide: IngredientsApi, useValue: { search: vi.fn(() => of([])) } },
        {
          provide: IngredientsFacade,
          useValue: {
            ingredients$: of([
              { id: 12, name: 'Boneless Skinless Chicken Breast' },
              { id: 34, name: 'Jasmine Rice' },
            ]),
            loadIfNeeded: loadIngredientsIfNeeded,
          },
        },
      ],
    });

    await TestBed.compileComponents();
  });

  afterEach(() => {
    document.body.style.overflow = '';
    vi.unstubAllGlobals();
  });

  it('shows an initial skeleton grid distinct from loaded cards', () => {
    isInitialLoading.set(true);
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(initializeFromUrl).toHaveBeenCalledOnce();
    expect(initializeFromUrl).toHaveBeenCalledWith(criteria());
    expect(root.querySelectorAll('.recipe-skeleton')).toHaveLength(8);
    expect(root.querySelector('app-recipe-card')).toBeNull();
    expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('renders up to 20 first-page cards and keeps initial visible images eager', () => {
    cards.set(Array.from({ length: 20 }, (_, index) => card(index + 1)));
    hasMore.set(true);
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const images = root.querySelectorAll<HTMLImageElement>('.recipe-card__image');

    const renderedCards = root.querySelectorAll('app-recipe-card');
    expect(renderedCards).toHaveLength(20);
    expect(renderedCards[0]?.classList).toContain('recipe-card--portrait-mobile');
    expect(root.textContent).toContain('20 recipes loaded');
    expect(images[0]?.getAttribute('loading')).toBe('eager');
    expect(images[3]?.getAttribute('loading')).toBe('eager');
    expect(images[4]?.getAttribute('loading')).toBe('lazy');
    expect(root.textContent).toContain('Load more recipes');
  });

  it('uses IntersectionObserver and the explicit button for the same next-page path', () => {
    cards.set([card(1)]);
    hasMore.set(true);
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(FakeIntersectionObserver.latest?.observe).toHaveBeenCalledOnce();
    FakeIntersectionObserver.latest?.trigger(true);
    (root.querySelector('.recipe-results__load-button') as HTMLButtonElement).click();

    expect(loadNextPage).toHaveBeenCalledTimes(2);
  });

  it('keeps existing cards visible and retries after a load-more failure', () => {
    cards.set([card(1), card(2)]);
    hasMore.set(true);
    loadMoreError.set('Could not load more recipes.');
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('app-recipe-card')).toHaveLength(2);
    expect(root.textContent).toContain('Could not load more recipes.');
    (root.querySelector('.recipe-results__load-button') as HTMLButtonElement).click();
    expect(retryLoadMore).toHaveBeenCalledOnce();
  });

  it('shows the end state and removes continuation triggers when no page remains', () => {
    cards.set([card(1)]);
    hasMore.set(false);
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('reached the end');
    expect(root.querySelector('.recipe-results__load-button')).toBeNull();
    expect(root.querySelector('.recipe-results__sentinel')).toBeNull();
  });

  it('renders initial error/retry and compatible-empty states', () => {
    initialError.set('Cannot reach the server.');
    const errorFixture = createFixture();
    const errorRoot = errorFixture.nativeElement as HTMLElement;
    expect(errorRoot.textContent).toContain('Cannot reach the server.');
    (errorRoot.querySelector('.recipe-results__action') as HTMLButtonElement).click();
    expect(retryInitial).toHaveBeenCalledOnce();

    initialError.set(null);
    errorFixture.detectChanges();
    expect(errorRoot.textContent).toContain('No compatible recipes available');
  });

  it('keeps typing local and applies normalized search only on form submission', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector('#recipe-search-input') as HTMLInputElement;
    const pageInstance = fixture.componentInstance;

    expect(input.name).toBe('search');

    input.value = '  chicken   rice  ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(initializeFromUrl).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();

    const submitEvent = submitSearchForm(fixture);

    expect(submitEvent.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: queryParams({ search: 'chicken rice' }),
    }));

    queryParamMap.next(convertToParamMap({ search: 'chicken rice' }));
    fixture.detectChanges();

    expect(fixture.componentInstance).toBe(pageInstance);
    expect(initializeFromUrl).toHaveBeenLastCalledWith(criteria('chicken rice'));
  });

  it('uses the shared search while keeping the Filters control feature-owned', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const sharedSearch = root.querySelector('app-recipe-search-bar') as HTMLElement;

    expect(sharedSearch).not.toBeNull();
    expect(sharedSearch.querySelector('.recipe-search__filters')).toBeNull();
    expect(root.querySelector('.recipe-search > .recipe-search__filters')).not.toBeNull();
  });

  it('restores and canonicalizes applied search from the URL', () => {
    queryParamMap.next(convertToParamMap({ search: '  Chicken   Rice  ' }));
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect((root.querySelector('#recipe-search-input') as HTMLInputElement).value)
      .toBe('Chicken Rice');
    expect(initializeFromUrl).toHaveBeenCalledWith(criteria('Chicken Rice'));
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: queryParams({ search: 'Chicken Rice' }),
      replaceUrl: true,
    }));
  });

  it('removes search from the URL when an empty draft is submitted', () => {
    queryParamMap.next(convertToParamMap({ search: 'chicken' }));
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector('#recipe-search-input') as HTMLInputElement;
    navigate.mockClear();

    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    submitSearchForm(fixture);

    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: queryParams(),
    }));
  });

  it('renders a search-specific empty state without unrelated recipes', () => {
    queryParamMap.next(convertToParamMap({ search: 'chick' }));
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('No recipes found for “chick”');
    expect(root.textContent).toContain('different recipe or ingredient name');
    expect(root.textContent).not.toContain('No compatible recipes available');
  });

  it('restores saved-only from the URL and removes its applied chip immediately', () => {
    queryParamMap.next(convertToParamMap({ search: 'chicken', savedOnly: 'true' }));
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const savedChip = root.querySelector(
      '[aria-label="Remove saved recipes only filter"]'
    ) as HTMLButtonElement;

    expect(initializeFromUrl).toHaveBeenCalledWith(criteria('chicken', {
      savedOnly: true,
    }));
    navigate.mockClear();
    savedChip.click();

    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: queryParams({ search: 'chicken' }),
    }));
  });

  it('canonicalizes invalid saved-only URL values by omitting the default', () => {
    queryParamMap.next(convertToParamMap({ savedOnly: 'false' }));
    createFixture();

    expect(initializeFromUrl).toHaveBeenCalledWith(criteria());
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: queryParams(),
      replaceUrl: true,
    }));
  });

  it('shows saved-only empty guidance and provides a clear action', () => {
    queryParamMap.next(convertToParamMap({ savedOnly: 'true' }));
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('No saved recipes match your criteria');
    expect(root.textContent).not.toContain('No compatible recipes available');
    navigate.mockClear();
    (root.querySelector('.recipe-results__action') as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: queryParams(),
    }));
  });

  it('renders all canonical categories inside one accessible expandable filter block', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const filtersButton = root.querySelector(
      '.recipe-search__filters'
    ) as HTMLButtonElement;

    expect(filtersButton.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('#recipe-advanced-filters')).toBeNull();
    filtersButton.click();
    fixture.detectChanges();

    expect(filtersButton.getAttribute('aria-expanded')).toBe('true');
    const filterPanel = root.querySelector('#recipe-advanced-filters') as HTMLElement;
    expect(filterPanel.parentElement).toBe(root.querySelector('.recipe-discovery-controls'));
    expect(filterPanel.getAttribute('role')).toBe('region');
    expect(filterPanel.hasAttribute('aria-modal')).toBe(false);
    expect(root.querySelectorAll('.recipe-filters__badge')).toHaveLength(9);
    expect(root.textContent).toContain('Meal Prep');
    const ranges = [...root.querySelectorAll<HTMLInputElement>('input[type="range"]')];
    expect(ranges).toHaveLength(2);
    expect(ranges.every(range => range.classList.contains('input-range--primary'))).toBe(true);
    expect(ranges[0].style.getPropertyValue('--input-range-progress')).toBe('0%');
    expect(ranges[1].style.getPropertyValue('--input-range-progress')).toBe('100%');
    expect(root.querySelector('.recipe-filters__badge')?.classList).toContain(
      'text-control-small'
    );
    expect(root.querySelector('.recipe-filters__selectors')?.textContent).toContain('Any');
    expect(root.querySelector('.recipe-filters__selectors')?.textContent).toContain('Hard');
    expect(root.querySelectorAll('[role="switch"]')).toHaveLength(2);
    expect(
      root.querySelector('[aria-label="Require all selected ingredients"]')
        ?.getAttribute('aria-checked')
    ).toBe('true');
  });

  it('keeps filter edits as draft and commits all criteria with one Apply action', () => {
    queryParamMap.next(convertToParamMap({ search: 'chicken' }));
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('.recipe-search__filters') as HTMLButtonElement).click();
    fixture.detectChanges();
    navigate.mockClear();

    const badges = [...root.querySelectorAll<HTMLButtonElement>('.recipe-filters__badge')];
    const autocomplete = fixture.debugElement.query(
      By.directive(IngredientAutocompleteComponent)
    ).componentInstance as IngredientAutocompleteComponent;
    autocomplete.selectedIngredientsChange.emit([
      { id: 34, name: 'Rice' },
      { id: 12, name: 'Chicken' },
      { id: 12, name: 'Duplicate Chicken' },
    ]);
    badges.find(button => button.textContent?.trim() === 'High Protein')?.click();
    badges.find(button => button.textContent?.trim() === 'Quick Meal')?.click();
    setRangeStop(root, 'input[name="maxTotalMinutes"]', '3');
    setRangeStop(root, 'input[name="maxDifficulty"]', '1');
    (root.querySelector(
      '[aria-label="Require all selected ingredients"]'
    ) as HTMLButtonElement).click();
    (root.querySelector('[aria-label="Saved recipes only"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(navigate).not.toHaveBeenCalled();
    expect(
      (root.querySelector('input[name="maxTotalMinutes"]') as HTMLInputElement)
        .style.getPropertyValue('--input-range-progress')
    ).toBe('60%');
    expect(
      (root.querySelector('input[name="maxDifficulty"]') as HTMLInputElement)
        .style.getPropertyValue('--input-range-progress')
    ).toBe('50%');
    (root.querySelector('.recipe-filters__apply') as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: queryParams({
        search: 'chicken',
        ingredientIds: [12, 34],
        requireAllIngredients: false,
        badges: ['High Protein', 'Quick Meal'],
        maxTotalMinutes: 45,
        maxDifficulty: 'Medium',
        savedOnly: true,
      }),
    }));
  });

  it('uses a modal mobile filter view, cancels with Escape, and restores page focus', async () => {
    vi.stubGlobal('matchMedia', createMatchMedia(true));
    document.body.style.overflow = 'auto';
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const filtersButton = root.querySelector(
      '.recipe-search__filters'
    ) as HTMLButtonElement;
    filtersButton.focus();
    filtersButton.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const filterPanel = root.querySelector('#recipe-advanced-filters') as HTMLElement;
    expect(filterPanel.getAttribute('role')).toBe('dialog');
    expect(filterPanel.getAttribute('aria-modal')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');

    const highProtein = [...root.querySelectorAll<HTMLButtonElement>(
      '.recipe-filters__badge'
    )].find(button => button.textContent?.trim() === 'High Protein')!;
    highProtein.click();
    filterPanel.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    }));
    fixture.detectChanges();
    await Promise.resolve();

    expect(root.querySelector('#recipe-advanced-filters')).toBeNull();
    expect(document.body.style.overflow).toBe('auto');
    expect(document.activeElement).toBe(filtersButton);
    expect(navigate).not.toHaveBeenCalled();

    filtersButton.click();
    fixture.detectChanges();
    const reopenedHighProtein = [...root.querySelectorAll<HTMLButtonElement>(
      '.recipe-filters__badge'
    )].find(button => button.textContent?.trim() === 'High Protein')!;
    expect(reopenedHighProtein.getAttribute('aria-pressed')).toBe('false');
  });

  it('discards uncommitted ingredient identity when filters close without Apply', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const filtersButton = root.querySelector(
      '.recipe-search__filters'
    ) as HTMLButtonElement;
    filtersButton.click();
    fixture.detectChanges();

    const autocomplete = fixture.debugElement.query(
      By.directive(IngredientAutocompleteComponent)
    ).componentInstance as IngredientAutocompleteComponent;
    autocomplete.selectedIngredientsChange.emit([{ id: 4, name: 'Chicken' }]);
    fixture.detectChanges();
    filtersButton.click();
    fixture.detectChanges();
    filtersButton.click();
    fixture.detectChanges();

    expect(root.querySelector('.ingredient-autocomplete__selected')).toBeNull();
  });

  it('restores ingredient IDs and ANY mode from URL and removes one applied chip', () => {
    queryParamMap.next(convertToParamMap({
      ingredientIds: ['12', '34'],
      requireAllIngredients: 'false',
    }));
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(initializeFromUrl).toHaveBeenCalledWith(criteria('', {
      ingredientIds: [12, 34],
      requireAllIngredients: false,
    }));
    expect(loadIngredientsIfNeeded).toHaveBeenCalledOnce();
    expect(root.textContent).toContain('Boneless Skinless Chicken Breast');
    expect(root.textContent).toContain('Jasmine Rice');
    expect(root.textContent).not.toContain('Any ingredient');
    (root.querySelector('.recipe-search__filters') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(
      root.querySelector('[aria-label="Require all selected ingredients"]')
        ?.getAttribute('aria-checked')
    ).toBe('false');

    navigate.mockClear();
    (root.querySelector(
      '[aria-label="Remove Boneless Skinless Chicken Breast filter"]'
    ) as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: queryParams({
        ingredientIds: [34],
        requireAllIngredients: false,
      }),
    }));
  });

  it('discards draft edits when filters close without Apply', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const filtersButton = root.querySelector(
      '.recipe-search__filters'
    ) as HTMLButtonElement;
    filtersButton.click();
    fixture.detectChanges();
    const highProtein = [...root.querySelectorAll<HTMLButtonElement>(
      '.recipe-filters__badge'
    )].find(button => button.textContent?.trim() === 'High Protein')!;
    highProtein.click();
    fixture.detectChanges();
    expect(highProtein.getAttribute('aria-pressed')).toBe('true');

    (root.querySelector('.recipe-filters__close') as HTMLButtonElement).click();
    fixture.detectChanges();
    filtersButton.click();
    fixture.detectChanges();

    const reopenedHighProtein = [...root.querySelectorAll<HTMLButtonElement>(
      '.recipe-filters__badge'
    )].find(button => button.textContent?.trim() === 'High Protein')!;
    expect(reopenedHighProtein.getAttribute('aria-pressed')).toBe('false');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('restores canonical repeated filters and removes an applied badge immediately', () => {
    queryParamMap.next(convertToParamMap({
      badges: ['Quick Meal', 'High Protein'],
      maxTotalMinutes: '45',
      maxDifficulty: 'Medium',
    }));
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(initializeFromUrl).toHaveBeenCalledWith(criteria('', {
      badges: ['High Protein', 'Quick Meal'],
      maxTotalMinutes: 45,
      maxDifficulty: 'Medium',
    }));
    expect(root.querySelectorAll('.recipe-applied-filter')).toHaveLength(2);
    expect(root.textContent).not.toContain('Up to 45 min');
    expect(root.textContent).not.toContain('Up to Medium');
    navigate.mockClear();
    (root.querySelector(
      '[aria-label="Remove High Protein filter"]'
    ) as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: queryParams({
        badges: ['Quick Meal'],
        maxTotalMinutes: 45,
        maxDifficulty: 'Medium',
      }),
    }));
  });

  it('canonicalizes invalid badge, time, difficulty, and duplicate URL values', () => {
    queryParamMap.next(convertToParamMap({
      badges: ['Quick Meal', 'unknown', 'Quick Meal'],
      maxTotalMinutes: '44',
      maxDifficulty: 'Hard',
    }));
    createFixture();

    expect(initializeFromUrl).toHaveBeenCalledWith(criteria('', {
      badges: ['Quick Meal'],
    }));
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: queryParams({ badges: ['Quick Meal'] }),
      replaceUrl: true,
    }));
  });

  it('shows filter-specific empty guidance and clears applied filters', () => {
    queryParamMap.next(convertToParamMap({ badges: ['High Protein'] }));
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('No recipes match your filters');
    navigate.mockClear();
    (root.querySelector('.recipe-results__action') as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: queryParams(),
    }));
  });

  it('clears every advanced criterion from the applied chip row in one navigation', () => {
    queryParamMap.next(convertToParamMap({
      search: 'chicken',
      ingredientIds: ['12'],
      badges: ['High Protein'],
      maxTotalMinutes: '60',
      maxDifficulty: 'Easy',
      savedOnly: 'true',
    }));
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    navigate.mockClear();

    (root.querySelector('.recipe-applied-filters__clear') as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: queryParams({ search: 'chicken' }),
    }));
  });

  it('removes transient cursor and seed parameters during canonical URL restoration', () => {
    queryParamMap.next(convertToParamMap({
      search: 'chicken',
      cursor: 'opaque-server-token',
      seed: 'legacy-seed',
    }));
    createFixture();

    expect(initializeFromUrl).toHaveBeenCalledWith(criteria('chicken'));
    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate.mock.calls[0]?.[1]).toEqual({
      relativeTo: activatedRoute,
      queryParams: queryParams({ search: 'chicken' }),
      replaceUrl: true,
    });
  });

  it('delegates card favorite activation and keeps loaded cards during feedback', () => {
    cards.set([card(7)]);
    favoriteFeedback.set({ recipeId: 7, message: 'Could not save this recipe.' });
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelector('.recipe-card__favorite') as HTMLButtonElement).click();

    expect(toggleFavorite).toHaveBeenCalledWith(7, false);
    expect(root.querySelectorAll('app-recipe-card')).toHaveLength(1);
    expect(root.querySelector('.recipe-card__favorite')?.getAttribute('title'))
      .toContain('Could not save this recipe.');
  });

  it('opens the shared Quick Preview with the selected card projection', () => {
    const selectedCard = card(7);
    cards.set([selectedCard]);
    const root = createFixture().nativeElement as HTMLElement;

    (root.querySelector('.recipe-card__selection') as HTMLElement).click();

    expect(openPreview).toHaveBeenCalledWith(selectedCard);
  });

  it('disables only the recipe heart with an in-flight favorite mutation', () => {
    cards.set([card(1), card(2)]);
    isFavoritePending.mockImplementation((recipeId: number) => recipeId === 1);
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const buttons = root.querySelectorAll<HTMLButtonElement>(
      '.recipe-card__favorite'
    );

    expect(buttons[0]?.disabled).toBe(true);
    expect(buttons[1]?.disabled).toBe(false);
  });
});

function createFixture() {
  const fixture = TestBed.createComponent(RecipesListComponent);
  fixture.detectChanges();
  return fixture;
}

function submitSearchForm(fixture: ReturnType<typeof createFixture>): Event {
  const event = new Event('submit', { bubbles: true, cancelable: true });
  (fixture.nativeElement.querySelector('.recipe-search-bar') as HTMLFormElement)
    .dispatchEvent(event);
  return event;
}

function setRangeStop(root: HTMLElement, selector: string, value: string): void {
  const input = root.querySelector(selector) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function criteria(
  search = '',
  overrides: Partial<RecipeDiscoveryCriteria> = {}
): RecipeDiscoveryCriteria {
  return {
    search,
    ingredientIds: [],
    requireAllIngredients: true,
    badges: [],
    maxTotalMinutes: null,
    maxDifficulty: null,
    savedOnly: false,
    ...overrides,
  };
}

function queryParams(
  overrides: Partial<RecipeDiscoveryQueryParams> = {}
): RecipeDiscoveryQueryParams {
  return {
    search: null,
    ingredientIds: null,
    requireAllIngredients: null,
    badges: null,
    maxTotalMinutes: null,
    maxDifficulty: null,
    savedOnly: null,
    ...overrides,
  };
}

function card(id: number): RecipeCardDto {
  return {
    id,
    name: `Recipe ${id}`,
    cardImageUrl: `https://cdn.example.com/cards/${id}.jpg`,
    totalTimeMinutes: 35,
    caloriesPerServing: 451,
    estimatedCostPerServing: 1.72,
    badges: ['High Protein', 'Meal Prep'],
    featuredIngredients: [
      { id: 100 + id, name: 'Chicken', featuredOrder: 1 },
      { id: 200 + id, name: 'Quinoa', featuredOrder: 2 },
    ],
    isSaved: false,
  };
}

class FakeIntersectionObserver {
  static latest: FakeIntersectionObserver | null = null;

  readonly observe = vi.fn();
  readonly disconnect = vi.fn();

  constructor(
    private readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit
  ) {
    FakeIntersectionObserver.latest = this;
  }

  trigger(isIntersecting: boolean): void {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

/** Creates a browser-compatible viewport matcher for desktop/mobile component tests. */
function createMatchMedia(matches: boolean): typeof window.matchMedia {
  return vi.fn((media: string) => ({
    matches,
    media,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as MediaQueryList));
}

/**
 * Shared recipe facade tests for Preview/detail caching and optimistic favorite membership.
 * Phase 13 also protects favorite behavior for shared Preview consumers outside Discovery.
 */
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { RecipeCardDto, RecipeDetailDto, RecipePreviewDto } from './recipe.model';
import { RecipesApi } from './recipe.api';
import { RecipeDetailsStore } from './recipe-details.store';
import { RecipesFacade } from './recipe.facade';
import { RecipePreviewStore } from './recipe-preview.store';
import { RecipesStore } from './recipes.store';

describe('RecipesFacade', () => {
  const getDetail = vi.fn();
  const getPreview = vi.fn();
  const saveFavorite = vi.fn();
  const removeFavorite = vi.fn();

  beforeEach(() => {
    getDetail.mockReset();
    getPreview.mockReset();
    saveFavorite.mockReset();
    removeFavorite.mockReset();
    TestBed.configureTestingModule({
      providers: [
        RecipesFacade,
        RecipeDetailsStore,
        RecipePreviewStore,
        RecipesStore,
        {
          provide: RecipesApi,
          useValue: {
            getPreview,
            getRecipeWithDetails: getDetail,
            saveFavorite,
            removeFavorite,
          },
        },
      ],
    });
  });

  it('announces discovery invalidation without owning discovery state', async () => {
    const facade = TestBed.inject(RecipesFacade);
    const invalidated = firstValueFrom(facade.queryInvalidated$);

    facade.invalidateQueries();

    await expect(invalidated).resolves.toBeUndefined();
  });

  it('returns a cached Preview without requesting or expiring it by time', async () => {
    const previewStore = TestBed.inject(RecipePreviewStore);
    previewStore.upsert(createPreview(1));
    const facade = TestBed.inject(RecipesFacade);

    expect(await firstValueFrom(facade.getPreview(1))).toEqual(createPreview(1));
    expect(getPreview).not.toHaveBeenCalled();
    expect(facade.previewRequestState(1)()).toEqual({ status: 'success', error: null });
  });

  it('coalesces duplicate concurrent Preview requests for one identity and ID', async () => {
    const pending = new Subject<RecipePreviewDto>();
    getPreview.mockReturnValue(pending);
    const facade = TestBed.inject(RecipesFacade);

    const first = firstValueFrom(facade.getPreview(2));
    const second = firstValueFrom(facade.getPreview(2));
    expect(facade.previewRequestState(2)().status).toBe('loading');
    pending.next(createPreview(2));
    pending.complete();

    await expect(Promise.all([first, second])).resolves.toEqual([
      createPreview(2),
      createPreview(2),
    ]);
    expect(getPreview).toHaveBeenCalledOnce();
  });

  it('loads different Preview IDs concurrently and caches each complete response', async () => {
    const firstPending = new Subject<RecipePreviewDto>();
    const secondPending = new Subject<RecipePreviewDto>();
    getPreview.mockImplementation((id: number) => id === 3 ? firstPending : secondPending);
    const facade = TestBed.inject(RecipesFacade);

    const first = firstValueFrom(facade.getPreview(3));
    const second = firstValueFrom(facade.getPreview(4));
    firstPending.next(createPreview(3));
    firstPending.complete();
    secondPending.next(createPreview(4));
    secondPending.complete();

    await Promise.all([first, second]);
    expect(getPreview).toHaveBeenCalledTimes(2);
    expect(await firstValueFrom(facade.getPreview(3))).toEqual(createPreview(3));
    expect(await firstValueFrom(facade.getPreview(4))).toEqual(createPreview(4));
  });

  it('exposes Preview failure state and allows explicit per-ID invalidation', async () => {
    getPreview.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404 }))
    );
    const facade = TestBed.inject(RecipesFacade);

    const result = await firstValueFrom(facade.getPreview(5), { defaultValue: null });

    expect(result).toBeNull();
    expect(facade.previewRequestState(5)().status).toBe('error');
    expect(facade.previewRequestState(5)().error).not.toBeNull();
    facade.invalidatePreview(5);
    expect(facade.previewRequestState(5)().status).toBe('idle');
  });

  it('rejects a Preview response started before an identity cache reset', async () => {
    const pending = new Subject<RecipePreviewDto>();
    getPreview.mockReturnValue(pending);
    const facade = TestBed.inject(RecipesFacade);
    const previewStore = TestBed.inject(RecipePreviewStore);
    const result = firstValueFrom(facade.getPreview(6), { defaultValue: null });

    previewStore.reset();
    pending.next(createPreview(6));
    pending.complete();

    await expect(result).resolves.toBeNull();
    expect(previewStore.get(6)).toBeNull();
  });

  it('rejects an in-flight Preview response after explicit per-ID invalidation', async () => {
    const pending = new Subject<RecipePreviewDto>();
    getPreview.mockReturnValue(pending);
    const facade = TestBed.inject(RecipesFacade);
    const previewStore = TestBed.inject(RecipePreviewStore);
    const result = firstValueFrom(facade.getPreview(7), { defaultValue: null });

    facade.invalidatePreview(7);
    pending.next(createPreview(7));
    pending.complete();

    await expect(result).resolves.toBeNull();
    expect(previewStore.get(7)).toBeNull();
    expect(facade.previewRequestState(7)().status).toBe('idle');
  });

  it('caches the first detail and does not duplicate a later request', async () => {
    const detail = createDetail(1);
    getDetail.mockReturnValueOnce(new Subject<RecipeDetailDto>());
    const response = getDetail.mock.results;
    const facade = TestBed.inject(RecipesFacade);

    const first = firstValueFrom(facade.getRecipeWithDetails(1));
    (response[0]?.value as Subject<RecipeDetailDto>).next(detail);
    (response[0]?.value as Subject<RecipeDetailDto>).complete();

    expect(await first).toEqual(detail);
    expect(await firstValueFrom(facade.getRecipeWithDetails(1))).toEqual(detail);
    expect(getDetail).toHaveBeenCalledTimes(1);
  });

  it('coalesces duplicate concurrent requests for one id', async () => {
    const pending = new Subject<RecipeDetailDto>();
    getDetail.mockReturnValue(pending);
    const facade = TestBed.inject(RecipesFacade);

    const first = firstValueFrom(facade.getRecipeWithDetails(2));
    const second = firstValueFrom(facade.getRecipeWithDetails(2));
    pending.next(createDetail(2));
    pending.complete();

    await Promise.all([first, second]);
    expect(getDetail).toHaveBeenCalledTimes(1);
  });

  it('allows different ids to load concurrently and reloads only an invalidated id', async () => {
    const pendingOne = new Subject<RecipeDetailDto>();
    const pendingTwo = new Subject<RecipeDetailDto>();
    getDetail.mockImplementation((id: number) => id === 3 ? pendingOne : pendingTwo);
    const facade = TestBed.inject(RecipesFacade);

    const one = firstValueFrom(facade.getRecipeWithDetails(3));
    const two = firstValueFrom(facade.getRecipeWithDetails(4));
    expect(getDetail).toHaveBeenCalledTimes(2);
    pendingOne.next(createDetail(3));
    pendingOne.complete();
    pendingTwo.next(createDetail(4));
    pendingTwo.complete();
    await Promise.all([one, two]);

    facade.invalidateDetail(3);
    const reload = new Subject<RecipeDetailDto>();
    getDetail.mockReturnValueOnce(reload);
    const reloaded = firstValueFrom(facade.getRecipeWithDetails(3));
    reload.next(createDetail(3));
    reload.complete();
    await reloaded;

    expect(getDetail).toHaveBeenCalledTimes(3);
    expect(await firstValueFrom(facade.getRecipeWithDetails(4))).toEqual(createDetail(4));
  });

  it('optimistically saves a card and blocks a competing mutation for the same recipe', () => {
    const pending = new Subject<void>();
    saveFavorite.mockReturnValue(pending);
    const store = TestBed.inject(RecipesStore);
    loadCard(store, false);
    const previewStore = TestBed.inject(RecipePreviewStore);
    previewStore.upsert(createPreview(1, false));
    const facade = TestBed.inject(RecipesFacade);

    facade.toggleFavorite(1);
    facade.toggleFavorite(1);

    expect(store.card(1)?.isSaved).toBe(true);
    expect(previewStore.get(1)?.isSaved).toBe(true);
    expect(facade.isFavoritePending(1)).toBe(true);
    expect(saveFavorite).toHaveBeenCalledOnce();
    expect(removeFavorite).not.toHaveBeenCalled();

    pending.next();
    pending.complete();
    expect(facade.isFavoritePending(1)).toBe(false);
    expect(store.card(1)?.isSaved).toBe(true);
    expect(previewStore.get(1)?.isSaved).toBe(true);
  });

  it('uses DELETE to optimistically remove an existing favorite', () => {
    removeFavorite.mockReturnValue(of(void 0));
    const store = TestBed.inject(RecipesStore);
    loadCard(store, true);
    const previewStore = TestBed.inject(RecipePreviewStore);
    previewStore.upsert(createPreview(1, true));
    const facade = TestBed.inject(RecipesFacade);

    facade.toggleFavorite(1);

    expect(removeFavorite).toHaveBeenCalledWith(1);
    expect(saveFavorite).not.toHaveBeenCalled();
    expect(store.card(1)?.isSaved).toBe(false);
    expect(previewStore.get(1)?.isSaved).toBe(false);
  });

  it('toggles a cached Preview favorite when no discovery card is loaded', () => {
    saveFavorite.mockReturnValue(of(void 0));
    const previewStore = TestBed.inject(RecipePreviewStore);
    previewStore.upsert(createPreview(9, false));
    const facade = TestBed.inject(RecipesFacade);

    facade.toggleFavorite(9);

    expect(saveFavorite).toHaveBeenCalledWith(9);
    expect(previewStore.get(9)?.isSaved).toBe(true);
    expect(TestBed.inject(RecipesStore).card(9)).toBeNull();
  });

  it('retains synchronized membership for a complete Card outside Discovery and Preview caches', () => {
    saveFavorite.mockReturnValue(of(void 0));
    const facade = TestBed.inject(RecipesFacade);

    facade.toggleFavorite(21, false);

    expect(saveFavorite).toHaveBeenCalledWith(21);
    expect(facade.favoriteSavedState(21, false)).toBe(true);
    expect(TestBed.inject(RecipesStore).card(21)).toBeNull();
    expect(TestBed.inject(RecipePreviewStore).get(21)).toBeNull();
  });

  it('does not expose an external Card membership override after identity cache reset', () => {
    saveFavorite.mockReturnValue(of(void 0));
    const facade = TestBed.inject(RecipesFacade);
    const previewStore = TestBed.inject(RecipePreviewStore);
    facade.toggleFavorite(21, false);

    previewStore.reset();

    expect(facade.favoriteSavedState(21, false)).toBe(false);
  });

  it('reverts optimistic membership and exposes non-destructive feedback on failure', () => {
    saveFavorite.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 }))
    );
    const store = TestBed.inject(RecipesStore);
    loadCard(store, false);
    const previewStore = TestBed.inject(RecipePreviewStore);
    previewStore.upsert(createPreview(1, false));
    const facade = TestBed.inject(RecipesFacade);

    facade.toggleFavorite(1);

    expect(store.card(1)?.isSaved).toBe(false);
    expect(previewStore.get(1)?.isSaved).toBe(false);
    expect(facade.isFavoritePending(1)).toBe(false);
    expect(facade.favoriteFeedback()).toEqual({
      recipeId: 1,
      message: 'Could not save this recipe. An internal server error occurred. Please try again.',
    });

    facade.dismissFavoriteFeedback();
    expect(facade.favoriteFeedback()).toBeNull();
  });

  it('does not restore old-identity favorite state after the recipe store resets', () => {
    const pending = new Subject<void>();
    saveFavorite.mockReturnValue(pending);
    const store = TestBed.inject(RecipesStore);
    loadCard(store, false);
    const facade = TestBed.inject(RecipesFacade);

    facade.toggleFavorite(1);
    store.reset();
    pending.error(new HttpErrorResponse({ status: 500 }));

    expect(store.cards()).toEqual([]);
    expect(facade.favoriteFeedback()).toBeNull();
    expect(facade.isFavoritePending(1)).toBe(false);
  });

  it('overlays an active favorite mutation on a Preview loaded during the request', async () => {
    const favoritePending = new Subject<void>();
    const previewPending = new Subject<RecipePreviewDto>();
    saveFavorite.mockReturnValue(favoritePending);
    getPreview.mockReturnValue(previewPending);
    const store = TestBed.inject(RecipesStore);
    loadCard(store, false);
    const facade = TestBed.inject(RecipesFacade);

    facade.toggleFavorite(1);
    const loaded = firstValueFrom(facade.getPreview(1));
    previewPending.next(createPreview(1, false));
    previewPending.complete();

    await expect(loaded).resolves.toMatchObject({ id: 1, isSaved: true });
    expect(TestBed.inject(RecipePreviewStore).get(1)?.isSaved).toBe(true);
    favoritePending.next();
    favoritePending.complete();
  });
});

function loadCard(store: RecipesStore, isSaved: boolean): void {
  const generation = store.beginQuery(
    {
      search: '',
      ingredientIds: [],
      requireAllIngredients: true,
      badges: [],
      maxTotalMinutes: null,
      maxDifficulty: null,
      savedOnly: false,
    },
    'browse'
  )!;
  store.replacePage({ items: [createCard(1, isSaved)], nextCursor: null, hasMore: false }, generation);
}

function createCard(id: number, isSaved: boolean): RecipeCardDto {
  return {
    id,
    name: `Recipe ${id}`,
    cardImageUrl: null,
    totalTimeMinutes: 30,
    caloriesPerServing: 400,
    estimatedCostPerServing: 3.5,
    badges: ['Quick Meal'],
    featuredIngredients: [],
    isSaved,
  };
}

function createDetail(id: number): RecipeDetailDto {
  return {
    id,
    name: `Recipe ${id}`,
    description: 'A complete recipe description.',
    previewImageUrl: `https://cdn.example.com/previews/recipe-${id}.jpg`,
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: 35,
    servings: 2,
    difficulty: 'Easy',
    badges: null,
    diets: null,
    estimatedCostPerServing: null,
    caloriesTotal: 100,
    proteinTotal: 10,
    carbsTotal: 20,
    caloriesPerServing: 50,
    proteinPerServing: 5,
    instructions: [{ title: 'Prepare', instruction: 'Cook' }],
    ingredients: [],
  };
}

function createPreview(id: number, isSaved = false): RecipePreviewDto {
  return {
    id,
    name: `Recipe ${id}`,
    description: 'A lightweight Preview.',
    previewImageUrl: `https://cdn.example.com/previews/recipe-${id}.jpg`,
    totalTimeMinutes: 35,
    caloriesPerServing: 50,
    proteinPerServing: 5,
    estimatedCostPerServing: 2.5,
    badges: ['Quick Meal'],
    ingredients: [{ id: 10 + id, name: 'Ingredient' }],
    isSaved,
  };
}

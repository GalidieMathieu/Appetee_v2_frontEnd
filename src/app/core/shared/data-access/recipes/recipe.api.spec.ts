/**
 * Contract tests for recipe HTTP methods and their exact query/body representation.
 * Phase 12 coverage protects the dedicated lightweight Preview route from full-detail reuse.
 */
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_URL } from '@app/core/api/api.config';
import {
  RecipeDetailDto,
  RecipeDiscoveryCriteria,
  RecipeDiscoveryPageDto,
  RecipePreviewDto,
} from './recipe.model';
import { RecipesApi } from './recipe.api';

describe('RecipesApi', () => {
  let api: RecipesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RecipesApi,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
      ],
    });

    api = TestBed.inject(RecipesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests the bounded discovery page contract from the recipes route', () => {
    const page: RecipeDiscoveryPageDto = {
      items: [{
        id: 42,
        name: 'Soup',
        cardImageUrl: 'https://cdn.example.com/cards/soup.jpg',
        totalTimeMinutes: 35,
        caloriesPerServing: 60,
        estimatedCostPerServing: 1.5,
        badges: ['Quick Meal'],
        featuredIngredients: [{ id: 7, name: 'Carrot', featuredOrder: 1 }],
        isSaved: false,
      }],
      nextCursor: null,
      hasMore: false,
    };
    let response: RecipeDiscoveryPageDto | undefined;

    api.discover().subscribe(value => response = value);

    const request = http.expectOne('/api/recipes');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);
    request.flush(page);
    expect(response).toEqual(page);
    expect(response?.items[0]?.cardImageUrl).toBe('https://cdn.example.com/cards/soup.jpg');
    expect(response?.items[0]).not.toHaveProperty('imageUrl');
  });

  it('forwards a continuation cursor unchanged as one opaque query value', () => {
    const cursor = 'v1.eyJtb2RlIjoiYnJvd3NlIn0._-+/=';

    api.discover(criteria(), cursor).subscribe();

    const request = http.expectOne(candidate =>
      candidate.url === '/api/recipes'
      && candidate.params.get('cursor') === cursor
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual(['cursor']);
    request.flush({ items: [], nextCursor: null, hasMore: false });
  });

  it('sends canonical repeated badges and applied limits with the opaque cursor', () => {
    const search = 'chick %_\\ rice';
    const cursor = 'search-cursor._-+/=';

    api.discover(criteria({
      search,
      ingredientIds: [12, 34],
      requireAllIngredients: false,
      badges: ['High Protein', 'Quick Meal'],
      maxTotalMinutes: 45,
      maxDifficulty: 'Medium',
      savedOnly: true,
    }), cursor).subscribe();

    const request = http.expectOne(candidate => candidate.url === '/api/recipes');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('search')).toBe(search);
    expect(request.request.params.getAll('ingredientIds')).toEqual(['12', '34']);
    expect(request.request.params.get('requireAllIngredients')).toBe('false');
    expect(request.request.params.getAll('badges')).toEqual([
      'High Protein',
      'Quick Meal',
    ]);
    expect(request.request.params.get('maxTotalMinutes')).toBe('45');
    expect(request.request.params.get('maxDifficulty')).toBe('Medium');
    expect(request.request.params.get('savedOnly')).toBe('true');
    expect(request.request.params.get('cursor')).toBe(cursor);
    expect(request.request.params.keys()).toEqual([
      'search',
      'ingredientIds',
      'requireAllIngredients',
      'badges',
      'maxTotalMinutes',
      'maxDifficulty',
      'savedOnly',
      'cursor',
    ]);
    request.flush({ items: [], nextCursor: null, hasMore: false });
  });

  it('sends three selected IDs and relies on the API default for ALL composition', () => {
    api.discover(criteria({
      ingredientIds: [12, 34, 99],
      requireAllIngredients: true,
    })).subscribe();

    const request = http.expectOne(candidate => candidate.url === '/api/recipes');
    expect(request.request.params.getAll('ingredientIds')).toEqual(['12', '34', '99']);
    expect(request.request.params.has('requireAllIngredients')).toBe(false);
    request.flush({ items: [], nextCursor: null, hasMore: false });
  });

  it('uses idempotent current-user favorite endpoints without an owner payload', () => {
    api.saveFavorite(42).subscribe();

    const saveRequest = http.expectOne('/api/recipes/42/favorite');
    expect(saveRequest.request.method).toBe('PUT');
    expect(saveRequest.request.body).toBeNull();
    saveRequest.flush(null, { status: 204, statusText: 'No Content' });

    api.removeFavorite(42).subscribe();

    const removeRequest = http.expectOne('/api/recipes/42/favorite');
    expect(removeRequest.request.method).toBe('DELETE');
    expect(removeRequest.request.body).toBeNull();
    removeRequest.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('uses the preview image contract for complete recipe details', () => {
    const detail = createDetail();
    let response: RecipeDetailDto | undefined;

    api.getRecipeWithDetails(42).subscribe(value => response = value);

    const request = http.expectOne('/api/recipes/42');
    expect(request.request.method).toBe('GET');
    request.flush(detail);
    expect(response?.previewImageUrl).toBe('https://cdn.example.com/previews/soup.jpg');
    expect(response).not.toHaveProperty('imageUrl');
  });

  it('requests the lightweight Preview contract from its dedicated by-ID route', () => {
    const preview = createPreview();
    let response: RecipePreviewDto | undefined;

    api.getPreview(42).subscribe(value => response = value);

    const request = http.expectOne('/api/recipes/42/preview');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);
    request.flush(preview);
    expect(response).toEqual(preview);
    expect(response?.previewImageUrl).toBe('https://cdn.example.com/previews/soup.jpg');
    expect(response).not.toHaveProperty('instructions');
    expect(response).not.toHaveProperty('servings');
  });
});

function criteria(
  overrides: Partial<RecipeDiscoveryCriteria> = {}
): RecipeDiscoveryCriteria {
  return {
    search: '',
    ingredientIds: [],
    requireAllIngredients: true,
    badges: [],
    maxTotalMinutes: null,
    maxDifficulty: null,
    savedOnly: false,
    ...overrides,
  };
}

function createDetail(): RecipeDetailDto {
  return {
    id: 42,
    name: 'Soup',
    description: 'A warming vegetable soup.',
    previewImageUrl: 'https://cdn.example.com/previews/soup.jpg',
    prepTimeMinutes: 15,
    cookTimeMinutes: 20,
    totalTimeMinutes: 35,
    servings: 2,
    difficulty: 'Easy',
    badges: ['Quick Meal'],
    diets: [],
    ingredients: [],
    instructions: [{ title: 'Prepare', instruction: 'Cook' }],
    caloriesTotal: 120,
    proteinTotal: 4,
    carbsTotal: 20,
    caloriesPerServing: 60,
    proteinPerServing: 2,
    estimatedCostPerServing: 1.5,
  };
}

function createPreview(): RecipePreviewDto {
  return {
    id: 42,
    name: 'Soup',
    description: 'A warming vegetable soup.',
    previewImageUrl: 'https://cdn.example.com/previews/soup.jpg',
    totalTimeMinutes: 35,
    caloriesPerServing: 60,
    proteinPerServing: 2,
    estimatedCostPerServing: 1.5,
    badges: ['Quick Meal'],
    ingredients: [{ id: 7, name: 'Carrot' }],
    isSaved: false,
  };
}

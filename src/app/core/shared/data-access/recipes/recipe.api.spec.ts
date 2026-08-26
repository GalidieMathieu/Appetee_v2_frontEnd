import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_URL } from '@app/core/api/api.config';
import { RecipeDetailDto, RecipeDiscoveryPageDto } from './recipe.model';
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

    api.discover(cursor).subscribe();

    const request = http.expectOne(candidate =>
      candidate.url === '/api/recipes'
      && candidate.params.get('cursor') === cursor
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual(['cursor']);
    request.flush({ items: [], nextCursor: null, hasMore: false });
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
});

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

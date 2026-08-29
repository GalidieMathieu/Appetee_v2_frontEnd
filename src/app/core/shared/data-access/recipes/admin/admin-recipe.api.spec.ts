import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_URL } from '@app/core/api/api.config';
import { RecipeSummaryDto } from '../recipe.model';
import { AdminRecipeApi } from './admin-recipe.api';

describe('AdminRecipeApi', () => {
  let api: AdminRecipeApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AdminRecipeApi,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
      ],
    });

    api = TestBed.inject(AdminRecipeApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it.each([
    ['create', 'POST', '/api/admin/recipe-details', (body: FormData) => api.create(body)],
    ['update', 'PUT', '/api/admin/recipe-details/42', (body: FormData) => api.update(42, body)],
  ])('uses previewImageUrl in the %s response contract', (_, method, url, request) => {
    const summary = createSummary();
    let response: RecipeSummaryDto | undefined;

    request(new FormData()).subscribe(value => response = value);

    const httpRequest = http.expectOne(url);
    expect(httpRequest.request.method).toBe(method);
    httpRequest.flush(summary);
    expect(response?.previewImageUrl).toBe('https://cdn.example.com/previews/soup.jpg');
    expect(response).not.toHaveProperty('imageUrl');
  });
});

function createSummary(): RecipeSummaryDto {
  return {
    id: 42,
    name: 'Soup',
    previewImageUrl: 'https://cdn.example.com/previews/soup.jpg',
    prepTimeMinutes: 15,
    servings: 2,
    difficulty: 'Easy',
    badges: [],
    diets: [],
    ingredients: [{ id: 7, name: 'Carrot' }],
    caloriesTotal: 120,
    proteinTotal: 4,
    carbsTotal: 20,
    caloriesPerServing: 60,
    proteinPerServing: 2,
    estimatedCostPerServing: 1.5,
  };
}

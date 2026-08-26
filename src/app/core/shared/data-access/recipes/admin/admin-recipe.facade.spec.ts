import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { RecipeDetailRequest, RecipeSummaryDto } from '../recipe.model';
import { RecipesFacade } from '../recipe.facade';
import { AdminRecipeApi } from './admin-recipe.api';
import { AdminRecipeFacade } from './admin-recipe.facade';
import { AdminRecipeStore } from './admin-recipe.store';

describe('AdminRecipeFacade', () => {
  const create = vi.fn();
  const update = vi.fn();

  beforeEach(() => {
    create.mockReset();
    update.mockReset();
    create.mockReturnValue(of(createSummary()));
    update.mockReturnValue(of(createSummary()));

    TestBed.configureTestingModule({
      providers: [
        AdminRecipeFacade,
        AdminRecipeStore,
        {
          provide: AdminRecipeApi,
          useValue: { create, update },
        },
        {
          provide: RecipesFacade,
          useValue: { invalidateDetail: vi.fn(), invalidateQueries: vi.fn() },
        },
      ],
    });
  });

  it.each([
    ['create', () => TestBed.inject(AdminRecipeFacade).createRecipeWithDetails(createRequest())],
    ['update', () => TestBed.inject(AdminRecipeFacade).updateRecipeWithDetails(42, createRequest())],
  ])('omits canonical totals from the %s FormData', async (_, runRequest) => {
    await firstValueFrom(runRequest());

    const formData = (create.mock.calls[0]?.[0] ?? update.mock.calls[0]?.[1]) as FormData;
    expect(Array.from(formData.keys())).not.toEqual(
      expect.arrayContaining([
        'caloriesTotal',
        'proteinTotal',
        'carbsTotal',
        'caloriesPerServing',
        'proteinPerServing',
        'estimatedCostPerServing',
      ])
    );
    expect(formData.get('name')).toBe('Soup');
    expect(formData.get('description')).toBe('A warming vegetable soup.');
    expect(formData.get('prepTimeMinutes')).toBe('15');
    expect(formData.get('cookTimeMinutes')).toBe('25');
    expect(formData.get('totalTimeMinutes')).toBe('45');
    expect(formData.get('ingredients[0].ingredientId')).toBe('7');
    expect(formData.get('ingredients[0].featuredOrder')).toBe('1');
    expect(formData.get('instructions[0].title')).toBe('Prepare');
    expect(formData.get('instructions[0].instruction')).toBe('Cook');
    expect(formData.has('instructions[0]')).toBe(false);
  });

  it.each([
    [401, 'You are not authorized. Please sign in again.'],
    [403, 'You do not have permission to perform this action.'],
  ])('surfaces a safe message when admin authoring returns %s', async (status, message) => {
    create.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status }))
    );
    const facade = TestBed.inject(AdminRecipeFacade);

    const result = await firstValueFrom(
      facade.createRecipeWithDetails(createRequest()),
      { defaultValue: null }
    );

    expect(result).toBeNull();
    expect(await firstValueFrom(facade.error$)).toBe(message);
    expect(await firstValueFrom(facade.isLoading$)).toBe(false);
  });

  it('returns the successful admin authoring response', async () => {
    const facade = TestBed.inject(AdminRecipeFacade);

    expect(await firstValueFrom(facade.createRecipeWithDetails(createRequest())))
      .toEqual(createSummary());
    expect(await firstValueFrom(facade.error$)).toBeNull();
  });
});

function createRequest(): RecipeDetailRequest {
  return {
    name: 'Soup',
    description: 'A warming vegetable soup.',
    image: null,
    instructions: [{ title: 'Prepare', instruction: 'Cook' }],
    prepTimeMinutes: 15,
    cookTimeMinutes: 25,
    totalTimeMinutes: 45,
    servings: 2,
    difficulty: 'Easy',
    badges: [],
    dietIds: [],
    ingredients: [{ ingredientId: 7, quantity: 100, unit: 'g', featuredOrder: 1 }],
  };
}

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

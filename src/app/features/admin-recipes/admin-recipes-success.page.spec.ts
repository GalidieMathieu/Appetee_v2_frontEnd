import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import {
  RecipeDetailDto,
  RecipeSummaryDto,
} from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';

import { AdminRecipesSuccessPageComponent } from './admin-recipes-success.page';

describe('AdminRecipesSuccessPageComponent image contract', () => {
  const getRecipeWithDetails = vi.fn();

  beforeEach(() => {
    getRecipeWithDetails.mockReset();

    TestBed.configureTestingModule({
      imports: [AdminRecipesSuccessPageComponent],
      providers: [
        provideRouter([
          {
            path: 'admin-recipes/create/success/:id',
            component: AdminRecipesSuccessPageComponent,
          },
        ]),
        {
          provide: RecipesFacade,
          useValue: { getRecipeWithDetails },
        },
      ],
    });
  });

  it('renders previewImageUrl from the create summary navigation state', async () => {
    getRecipeWithDetails.mockReturnValue(of(createDetail(null)));
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/admin-recipes/create/success/42', {
      state: {
        recipeSummary: createSummary('https://cdn.example.com/previews/created-soup.jpg'),
      },
    });
    harness.fixture.detectChanges();
    const root = harness.fixture.nativeElement as HTMLElement;

    expect(getRecipeWithDetails).not.toHaveBeenCalled();
    expect(
      root
        .querySelector<HTMLImageElement>('.recipe-created-summary__media img')
        ?.getAttribute('src')
    ).toBe('https://cdn.example.com/previews/created-soup.jpg');
  });

  it('renders previewImageUrl from the complete recipe detail response', async () => {
    getRecipeWithDetails.mockReturnValue(of(createDetail(
      'https://cdn.example.com/previews/soup.jpg'
    )));
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl(
      '/admin-recipes/create/success/42',
      AdminRecipesSuccessPageComponent
    );

    expect(
      harness.routeNativeElement
        ?.querySelector<HTMLImageElement>('.recipe-created-summary__media img')
        ?.getAttribute('src')
    ).toBe('https://cdn.example.com/previews/soup.jpg');
  });

  it('keeps the no-image placeholder when previewImageUrl is null', async () => {
    getRecipeWithDetails.mockReturnValue(of(createDetail(null)));
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl(
      '/admin-recipes/create/success/42',
      AdminRecipesSuccessPageComponent
    );

    expect(harness.routeNativeElement?.querySelector('.recipe-created-summary__media img'))
      .toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('No image uploaded');
  });
});

function createDetail(previewImageUrl: string | null): RecipeDetailDto {
  return {
    id: 42,
    name: 'Soup',
    description: 'A warming vegetable soup.',
    previewImageUrl,
    prepTimeMinutes: 15,
    cookTimeMinutes: 20,
    totalTimeMinutes: 35,
    servings: 2,
    difficulty: 'Easy',
    badges: [],
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

function createSummary(previewImageUrl: string | null): RecipeSummaryDto {
  return {
    id: 42,
    name: 'Soup',
    previewImageUrl,
    prepTimeMinutes: 15,
    servings: 2,
    difficulty: 'Easy',
    badges: [],
    diets: [],
    ingredients: [],
    caloriesTotal: 120,
    proteinTotal: 4,
    carbsTotal: 20,
    caloriesPerServing: 60,
    proteinPerServing: 2,
    estimatedCostPerServing: 1.5,
  };
}

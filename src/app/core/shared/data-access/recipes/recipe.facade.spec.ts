import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Subject } from 'rxjs';
import { vi } from 'vitest';

import { RecipeDetailDto } from './recipe.model';
import { RecipesApi } from './recipe.api';
import { RecipeDetailsStore } from './recipe-details.store';
import { RecipesFacade } from './recipe.facade';

describe('RecipesFacade', () => {
  const getDetail = vi.fn();

  beforeEach(() => {
    getDetail.mockReset();
    TestBed.configureTestingModule({
      providers: [
        RecipesFacade,
        RecipeDetailsStore,
        {
          provide: RecipesApi,
          useValue: { getRecipeWithDetails: getDetail },
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
});

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

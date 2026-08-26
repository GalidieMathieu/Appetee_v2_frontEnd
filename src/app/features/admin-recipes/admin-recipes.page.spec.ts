import { TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, ParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';

import { DietsFacade } from '@app/core/shared/data-access/diets/diets.facade';
import { IngredientDetailsFacade } from '@app/core/shared/data-access/ingredients/admin/ingredient-details.facade';
import { IngredientsFacade } from '@app/core/shared/data-access/ingredients/ingredient.facade';
import { AdminRecipeFacade } from '@app/core/shared/data-access/recipes/admin/admin-recipe.facade';
import {
  RecipeDetailDto,
  RecipeSummaryDto,
} from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';

import { AdminRecipesPageComponent } from './admin-recipes.page';

describe('AdminRecipesPageComponent authoring', () => {
  const updateRecipeWithDetails = vi.fn();
  const dialogOpen = vi.fn();
  const getIngredientDetail = vi.fn();
  const routeParamMap = new BehaviorSubject<ParamMap>(convertToParamMap({ id: '42' }));

  beforeEach(async () => {
    updateRecipeWithDetails.mockReset();
    dialogOpen.mockReset();
    dialogOpen.mockReturnValue({});
    getIngredientDetail.mockReset();
    updateRecipeWithDetails.mockReturnValue(of(createSummary()));
    routeParamMap.next(convertToParamMap({ id: '42' }));
    const paramMap = convertToParamMap({ id: '42' });

    TestBed.configureTestingModule({
      imports: [AdminRecipesPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: routeParamMap.asObservable(), snapshot: { paramMap } },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: DietsFacade,
          useValue: { diets$: of([]), loadIfNeeded: vi.fn() },
        },
        { provide: IngredientsFacade, useValue: {} },
        { provide: IngredientDetailsFacade, useValue: { get: getIngredientDetail } },
        {
          provide: RecipesFacade,
          useValue: { getRecipesWithDetails: vi.fn(() => of(createDetail())) },
        },
        {
          provide: AdminRecipeFacade,
          useValue: {
            error$: of(null),
            isLoading$: of(false),
            createRecipeWithDetails: vi.fn(),
            updateRecipeWithDetails,
          },
        },
      ],
    });
    TestBed.overrideProvider(MatDialog, { useValue: { open: dialogOpen } });
    await TestBed.compileComponents();
  });

  it('keeps a live preview and replaces it with canonical totals after update', () => {
    const fixture = TestBed.createComponent(AdminRecipesPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    const previewImage = () => root
      .querySelector<HTMLImageElement>('.recipe-summary__image img')
      ?.getAttribute('src');

    expect(component.totalCalories).toBe(999);
    expect(component.caloriesPerServing).toBe(500);
    expect(component.proteinPerServing).toBe(50);
    expect(previewImage()).toBe('https://cdn.example.com/previews/detail-soup.jpg');

    component.form.controls.servings.setValue(4);

    expect(component.totalCalories).toBe(200);
    expect(component.totalProtein).toBe(20);
    expect(component.caloriesPerServing).toBe(50);
    expect(component.proteinPerServing).toBe(5);
    expect(component.totalCarbs).toBe(40);
    expect(component.estimatedCostPerServing).toBe(2);

    component.saveRecipe();
    fixture.detectChanges();

    expect(updateRecipeWithDetails).toHaveBeenCalledWith(
      42,
      expect.not.objectContaining({
        caloriesTotal: expect.anything(),
        proteinTotal: expect.anything(),
        carbsTotal: expect.anything(),
        caloriesPerServing: expect.anything(),
        proteinPerServing: expect.anything(),
        estimatedCostPerServing: expect.anything(),
      })
    );
    expect(component.totalCalories).toBe(321);
    expect(component.totalProtein).toBe(32);
    expect(component.caloriesPerServing).toBe(161);
    expect(component.proteinPerServing).toBe(16);
    expect(component.totalCarbs).toBe(64);
    expect(component.estimatedCostPerServing).toBeNull();
    expect(previewImage()).toBe('https://cdn.example.com/previews/updated-soup.jpg');
  });

  it('initializes create mode with one required instruction step', () => {
    routeParamMap.next(convertToParamMap({}));
    const fixture = TestBed.createComponent(AdminRecipesPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.instructionsControl.length).toBe(1);
    expect(component.instructionsControl.at(0).getRawValue()).toEqual({
      title: '',
      instruction: '',
    });
    expect(component.instructionsControl.hasError('required')).toBe(true);

    component.saveRecipe();
    fixture.detectChanges();

    const title = fixture.nativeElement.querySelector('#recipe-step-title-0') as HTMLInputElement;
    const instruction = fixture.nativeElement.querySelector(
      '#recipe-step-instruction-0'
    ) as HTMLTextAreaElement;
    expect(title.getAttribute('aria-invalid')).toBe('true');
    expect(instruction.getAttribute('aria-invalid')).toBe('true');

    component.removeInstructionStep(0);
    expect(component.instructionsControl.hasError('required')).toBe(true);
  });

  it('reorders existing controls and submits trimmed steps in displayed order', () => {
    const fixture = TestBed.createComponent(AdminRecipesPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const firstControl = component.instructionsControl.at(0);
    expect(firstControl.getRawValue()).toEqual({ title: 'Prepare', instruction: 'Cook' });
    firstControl.setValue({ title: ' First ', instruction: ' Do first ' });
    component.addInstructionStep({ title: ' Second ', instruction: ' Do second ' });
    component.addInstructionStep({ title: ' Third ', instruction: ' Do third ' });

    component.moveInstructionStepDown(0);
    component.moveInstructionStepUp(2);
    component.saveRecipe();

    expect(component.instructionsControl.at(2)).toBe(firstControl);
    expect(updateRecipeWithDetails).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        instructions: [
          { title: 'Second', instruction: 'Do second' },
          { title: 'Third', instruction: 'Do third' },
          { title: 'First', instruction: 'Do first' },
        ],
      })
    );
  });

  it('discards a fully blank middle step from the request', () => {
    const fixture = TestBed.createComponent(AdminRecipesPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.addInstructionStep({ title: ' ', instruction: '   ' });
    component.addInstructionStep({ title: 'Serve', instruction: 'Plate the soup.' });

    component.saveRecipe();

    expect(component.instructionsControl.length).toBe(3);
    expect(updateRecipeWithDetails).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        instructions: [
          { title: 'Prepare', instruction: 'Cook' },
          { title: 'Serve', instruction: 'Plate the soup.' },
        ],
      })
    );
  });

  it('rejects a partially completed step with field-specific feedback', () => {
    const fixture = TestBed.createComponent(AdminRecipesPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.addInstructionStep({ title: 'Finish', instruction: '   ' });

    component.saveRecipe();
    fixture.detectChanges();

    expect(updateRecipeWithDetails).not.toHaveBeenCalled();
    const instruction = fixture.nativeElement.querySelector(
      '#recipe-step-instruction-1'
    ) as HTMLTextAreaElement;
    expect(instruction.getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('Step instructions are required.');
  });

  it('prevents appending an ingredient ID already linked to the recipe', () => {
    dialogOpen.mockReturnValueOnce({
      afterClosed: () => of({ ingredientId: 7, quantity: 100, unit: 'g' }),
    });
    const fixture = TestBed.createComponent(AdminRecipesPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openIngredientDialog();
    fixture.detectChanges();

    expect(component.ingredientCount).toBe(1);
    expect(getIngredientDetail).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'This ingredient is already linked to the recipe.'
    );
    const addButton = fixture.nativeElement.querySelector(
      '.recipe-card__action'
    ) as HTMLButtonElement;
    expect(addButton.getAttribute('aria-describedby')).toBe(
      'recipe-duplicate-ingredient-error'
    );
  });

  it('continues to append a newly selected ingredient', () => {
    dialogOpen.mockReturnValueOnce({
      afterClosed: () => of({ ingredientId: 8, quantity: 50, unit: 'g' }),
    });
    getIngredientDetail.mockReturnValueOnce(of({
      ...createDetail().ingredients[0].ingredient,
      id: 8,
      name: 'Onion',
    }));
    const fixture = TestBed.createComponent(AdminRecipesPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openIngredientDialog();

    expect(component.ingredientCount).toBe(2);
    expect(getIngredientDetail).toHaveBeenCalledWith(8);
  });

  it('requires canonical description and valid prep/cook/total times', () => {
    const fixture = TestBed.createComponent(AdminRecipesPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.form.patchValue({
      description: '   ',
      prepTimeMinutes: 20,
      cookTimeMinutes: 30,
      totalTimeMinutes: 15,
    });
    component.saveRecipe();
    fixture.detectChanges();
    fixture.detectChanges();

    expect(updateRecipeWithDetails).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Recipe description is required.');
    expect(fixture.nativeElement.textContent).toContain(
      'Total time must be at least the prep time and cook time.'
    );
  });

  it('submits trimmed source fields and sequential featured ingredient orders', () => {
    dialogOpen.mockReturnValueOnce({
      afterClosed: () => of({ ingredientId: 8, quantity: 50, unit: 'g' }),
    });
    getIngredientDetail.mockReturnValueOnce(of({
      ...createDetail().ingredients[0].ingredient,
      id: 8,
      name: 'Onion',
    }));
    const fixture = TestBed.createComponent(AdminRecipesPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.patchValue({
      description: '  A comforting soup.  ',
      cookTimeMinutes: 20,
      totalTimeMinutes: 40,
      badges: ['High Protein', 'Budget Friendly'],
    });

    component.openIngredientDialog();
    component.toggleFeaturedIngredient(1);
    component.toggleFeaturedIngredient(0);
    component.toggleFeaturedIngredient(0);
    component.saveRecipe();

    expect(updateRecipeWithDetails).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        description: 'A comforting soup.',
        prepTimeMinutes: 15,
        cookTimeMinutes: 20,
        totalTimeMinutes: 40,
        badges: ['High Protein', 'Budget Friendly'],
        ingredients: [
          expect.objectContaining({ ingredientId: 7, featuredOrder: 2 }),
          expect.objectContaining({ ingredientId: 8, featuredOrder: 1 }),
        ],
      })
    );
  });

  it('limits authoring to three featured ingredients', () => {
    for (const ingredientId of [8, 9, 10]) {
      dialogOpen.mockReturnValueOnce({
        afterClosed: () => of({ ingredientId, quantity: 50, unit: 'g' }),
      });
    }
    getIngredientDetail.mockImplementation((ingredientId: number) => of({
      ...createDetail().ingredients[0].ingredient,
      id: ingredientId,
      name: `Ingredient ${ingredientId}`,
    }));
    const fixture = TestBed.createComponent(AdminRecipesPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openIngredientDialog();
    component.openIngredientDialog();
    component.openIngredientDialog();
    component.toggleFeaturedIngredient(1);
    component.toggleFeaturedIngredient(2);
    component.toggleFeaturedIngredient(3);
    component.saveRecipe();

    expect(updateRecipeWithDetails).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        ingredients: [
          expect.objectContaining({ ingredientId: 7, featuredOrder: 1 }),
          expect.objectContaining({ ingredientId: 8, featuredOrder: 2 }),
          expect.objectContaining({ ingredientId: 9, featuredOrder: 3 }),
          expect.objectContaining({ ingredientId: 10, featuredOrder: null }),
        ],
      })
    );
  });

  it('requires at least one featured ingredient', () => {
    const fixture = TestBed.createComponent(AdminRecipesPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.toggleFeaturedIngredient(0);
    component.saveRecipe();
    fixture.detectChanges();

    expect(updateRecipeWithDetails).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Choose between one and three featured ingredients before saving.'
    );
  });
});

function createDetail(): RecipeDetailDto {
  return {
    ...createSummary(),
    previewImageUrl: 'https://cdn.example.com/previews/detail-soup.jpg',
    description: 'A warming vegetable soup.',
    cookTimeMinutes: 20,
    totalTimeMinutes: 35,
    caloriesTotal: 999,
    proteinTotal: 99,
    carbsTotal: 199,
    caloriesPerServing: 499.5,
    proteinPerServing: 49.5,
    estimatedCostPerServing: 9,
    instructions: [{ title: 'Prepare', instruction: 'Cook' }],
    ingredients: [
      {
        ingredientId: 7,
        quantity: 200,
        unit: 'g',
        featuredOrder: 1,
        ingredient: {
          id: 7,
          name: 'Carrot',
          basis: 100,
          basisUnit: 'g',
          price: 4,
          caloriesKcal: 100,
          imageUrl: null,
          proteinG: 10,
          fatG: null,
          carbsG: 20,
          sugarG: null,
          fiberG: null,
          sodiumMg: null,
          vitaminCMg: null,
          ironMg: null,
        },
      },
    ],
  };
}

function createSummary(): RecipeSummaryDto {
  return {
    id: 42,
    name: 'Soup',
    previewImageUrl: 'https://cdn.example.com/previews/updated-soup.jpg',
    prepTimeMinutes: 15,
    servings: 2,
    difficulty: 'Easy',
    badges: [],
    diets: [],
    ingredients: [{ id: 7, name: 'Carrot' }],
    caloriesTotal: 321,
    proteinTotal: 32,
    carbsTotal: 64,
    caloriesPerServing: 160.5,
    proteinPerServing: 16,
    estimatedCostPerServing: null,
  };
}

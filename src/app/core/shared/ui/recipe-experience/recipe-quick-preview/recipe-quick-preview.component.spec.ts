/**
 * Preview coverage verifies immediate compact metrics, lazy-only skeletons, bounded ingredients,
 * retry/favorite actions from any Card source, and the intentionally disabled Cooking action.
 */
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { EntityRequestState } from '@app/core/shared/data-access/generic-template/entity-cache-store';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import {
  RecipeCardDto,
  RecipePreviewDto,
} from '@app/core/shared/data-access/recipes/recipe.model';

import { RecipeQuickPreviewComponent } from './recipe-quick-preview.component';

describe('RecipeQuickPreviewComponent', () => {
  const card = createCard();
  const preview = signal<RecipePreviewDto | null>(null);
  const currentCard = signal<RecipeCardDto | null>(card);
  const requestState = signal<EntityRequestState>({ status: 'loading', error: null });
  const favoriteFeedback = signal<{ recipeId: number; message: string } | null>(null);
  const getPreview = vi.fn(() => of(createPreview()));
  const toggleFavorite = vi.fn();
  const dismissFavoriteFeedback = vi.fn();
  const close = vi.fn();

  beforeEach(() => {
    preview.set(null);
    currentCard.set(card);
    requestState.set({ status: 'loading', error: null });
    favoriteFeedback.set(null);
    getPreview.mockClear();
    toggleFavorite.mockReset();
    dismissFavoriteFeedback.mockReset();
    close.mockReset();

    TestBed.configureTestingModule({
      imports: [RecipeQuickPreviewComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { recipeId: card.id, card } },
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: RecipesFacade,
          useValue: {
            previewFor: () => preview,
            cardFor: () => currentCard,
            previewRequestState: () => requestState,
            favoriteFeedback,
            isFavoritePending: () => false,
            getPreview,
            toggleFavorite,
            dismissFavoriteFeedback,
          },
        },
      ],
    });
  });

  it('renders card-known fields immediately and skeletonizes only lazy fields', () => {
    const root = createFixture().nativeElement as HTMLElement;

    expect(root.textContent).toContain(card.name);
    expect(root.textContent).toContain('Total time');
    expect(root.textContent).toContain('30 min');
    expect(root.textContent).toContain('420 cal');
    expect(root.textContent).toContain('$2.50');
    const metricValue = root.querySelector('.recipe-quick-preview__metrics dd') as HTMLElement;
    const metricIcon = root.querySelector(
      '.recipe-quick-preview__metrics dt mat-icon'
    ) as HTMLElement;
    expect(metricValue.classList).toContain('text-label');
    expect(metricValue.classList).toContain('text-metric-value');
    expect(metricIcon.hasAttribute('inline')).toBe(true);
    expect(root.querySelector('.recipe-quick-preview__skeleton--description')).not.toBeNull();
    expect(root.querySelector('.recipe-quick-preview__skeleton--metric')).not.toBeNull();
    expect(root.querySelector('.recipe-quick-preview__ingredient-skeletons')).not.toBeNull();
    expect(getPreview).toHaveBeenCalledOnce();
  });

  it('renders canonical Preview content, six ingredients, and noninteractive remainder text', () => {
    preview.set(createPreview());
    requestState.set({ status: 'success', error: null });
    const root = createFixture().nativeElement as HTMLElement;
    const ingredients = root.querySelectorAll('.recipe-quick-preview__ingredient-list li');
    const remaining = root.querySelector('.recipe-quick-preview__remaining');

    expect(root.textContent).toContain('A complete lightweight preview.');
    expect(root.textContent).toContain('38.5 g');
    expect(ingredients).toHaveLength(6);
    expect(remaining?.textContent).toContain('+ 2 more ingredients');
    expect(remaining?.matches('button, a, [role="button"]')).toBe(false);
    expect(root.textContent).not.toContain('View Full Recipe');
    expect(root.textContent).not.toContain('Servings');
    const cooking = [...root.querySelectorAll('button')]
      .find(button => button.textContent?.includes('Start Cooking'));
    expect(cooking?.disabled).toBe(true);
  });

  it('retries failed lazy details without removing immediate card content', () => {
    requestState.set({ status: 'error', error: 'Recipe was not found.' });
    const root = createFixture().nativeElement as HTMLElement;

    expect(root.textContent).toContain(card.name);
    expect(root.textContent).toContain('Preview details are unavailable.');
    (root.querySelector('.recipe-quick-preview__error button') as HTMLButtonElement).click();
    expect(getPreview).toHaveBeenCalledTimes(2);
  });

  it('delegates favorite from passed Card data before a non-Discovery Preview finishes loading', () => {
    currentCard.set(null);
    const root = createFixture().nativeElement as HTMLElement;

    const saveButton = [...root.querySelectorAll('button')]
      .find(button => button.textContent?.includes('Save Recipe'))!;
    expect(saveButton.disabled).toBe(false);
    saveButton.click();
    (root.querySelector('.recipe-quick-preview__close') as HTMLButtonElement).click();

    expect(toggleFavorite).toHaveBeenCalledWith(card.id, false);
    expect(close).toHaveBeenCalledOnce();
  });
});

function createFixture() {
  const fixture = TestBed.createComponent(RecipeQuickPreviewComponent);
  fixture.detectChanges();
  return fixture;
}

function createCard(): RecipeCardDto {
  return {
    id: 12,
    name: 'Fast Chicken Bowl',
    cardImageUrl: 'https://cdn.example.com/cards/12.jpg',
    totalTimeMinutes: 30,
    caloriesPerServing: 420,
    estimatedCostPerServing: 2.5,
    badges: ['High Protein'],
    featuredIngredients: [],
    isSaved: false,
  };
}

function createPreview(): RecipePreviewDto {
  return {
    id: 12,
    name: 'Fast Chicken Bowl',
    description: 'A complete lightweight preview.',
    previewImageUrl: 'https://cdn.example.com/previews/12.jpg',
    totalTimeMinutes: 30,
    caloriesPerServing: 420,
    proteinPerServing: 38.5,
    estimatedCostPerServing: 2.5,
    badges: ['High Protein'],
    ingredients: Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      name: `Ingredient ${index + 1}`,
    })),
    isSaved: false,
  };
}

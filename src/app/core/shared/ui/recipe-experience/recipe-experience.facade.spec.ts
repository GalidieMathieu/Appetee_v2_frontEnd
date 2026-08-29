/**
 * UI-facade tests protect the single Card entry flow and its delegation to shared recipe data access.
 * Feature pages should never need Material dialog or favorite-mutation coordination after this seam.
 */
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { vi } from 'vitest';

import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';

import { RecipeExperienceFacade } from './recipe-experience.facade';
import { RecipeQuickPreviewComponent } from './recipe-quick-preview/recipe-quick-preview.component';

describe('RecipeExperienceFacade', () => {
  const open = vi.fn();
  const toggleFavorite = vi.fn();
  const favoriteSavedState = vi.fn();
  const isFavoritePending = vi.fn();
  const favoriteFeedback = signal<{ recipeId: number; message: string } | null>(null);

  beforeEach(() => {
    open.mockReset();
    toggleFavorite.mockReset();
    favoriteSavedState.mockReset();
    isFavoritePending.mockReset();
    favoriteFeedback.set(null);
    TestBed.configureTestingModule({
      providers: [
        RecipeExperienceFacade,
        { provide: MatDialog, useValue: { open } },
        {
          provide: RecipesFacade,
          useValue: {
            toggleFavorite,
            favoriteSavedState,
            isFavoritePending,
            favoriteFeedback,
          },
        },
      ],
    });
  });

  it('opens the shared Preview with known Card data and focus restoration', () => {
    const card = createCard();

    TestBed.inject(RecipeExperienceFacade).openPreview(card);

    expect(open).toHaveBeenCalledWith(
      RecipeQuickPreviewComponent,
      expect.objectContaining({
        data: { recipeId: card.id, card },
        panelClass: 'recipe-quick-preview-panel',
        restoreFocus: true,
      })
    );
  });

  it('delegates favorite state and mutation without owning data behavior', () => {
    favoriteSavedState.mockReturnValue(true);
    isFavoritePending.mockReturnValue(false);
    const facade = TestBed.inject(RecipeExperienceFacade);

    facade.toggleFavorite(12, false);

    expect(toggleFavorite).toHaveBeenCalledWith(12, false);
    expect(facade.favoriteSavedState(12, false)).toBe(true);
    expect(facade.isFavoritePending(12)).toBe(false);
  });
});

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

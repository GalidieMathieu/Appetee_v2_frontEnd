/**
 * Public UI-orchestration boundary for the shared Recipe Card -> Quick Preview experience.
 * Raw requests, caches, and authoritative mutation behavior remain in shared recipe data access.
 */
import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';

import {
  RecipeQuickPreviewComponent,
  RecipeQuickPreviewData,
} from './recipe-quick-preview/recipe-quick-preview.component';

@Injectable({ providedIn: 'root' })
export class RecipeExperienceFacade {
  private readonly recipes = inject(RecipesFacade);
  private readonly dialog = inject(MatDialog);

  /** Opens one responsive dialog with known Card fields available before lazy Preview data. */
  openPreview(recipe: RecipeCardDto): void {
    this.dialog.open<RecipeQuickPreviewComponent, RecipeQuickPreviewData, void>(
      RecipeQuickPreviewComponent,
      {
        data: { recipeId: recipe.id, card: recipe },
        panelClass: 'recipe-quick-preview-panel',
        width: 'min(45rem, 100vw)',
        maxWidth: '100vw',
        maxHeight: '100dvh',
        autoFocus: '.recipe-quick-preview__close',
        restoreFocus: true,
        ariaLabelledBy: 'recipe-quick-preview-title',
      }
    );
  }

  toggleFavorite(recipeId: number, currentSavedState: boolean): void {
    this.recipes.toggleFavorite(recipeId, currentSavedState);
  }

  favoriteSavedState(recipeId: number, fallback: boolean): boolean {
    return this.recipes.favoriteSavedState(recipeId, fallback);
  }

  isFavoritePending(recipeId: number): boolean {
    return this.recipes.isFavoritePending(recipeId);
  }

  favoriteFeedbackFor(recipeId: number): string | null {
    const feedback = this.recipes.favoriteFeedback();
    return feedback?.recipeId === recipeId ? feedback.message : null;
  }

}

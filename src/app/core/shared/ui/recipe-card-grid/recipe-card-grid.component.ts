/**
 * Shared full-page Recipe Card grid presentation for Discovery and Favorites.
 * It owns responsive iteration and skeletons while feature pages retain all query state.
 */
import { Component, input } from '@angular/core';

import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipeCardComponent } from '../recipe-experience/recipe-card/recipe-card.component';

@Component({
  selector: 'app-recipe-card-grid',
  standalone: true,
  imports: [RecipeCardComponent],
  templateUrl: './recipe-card-grid.component.html',
  styleUrl: './recipe-card-grid.component.scss',
})
export class RecipeCardGridComponent {
  readonly recipes = input.required<readonly RecipeCardDto[]>();
  readonly loading = input(false);
  readonly skeletonCount = input(8);
  readonly eagerImageCount = input(4);
  readonly ariaLabel = input('Recipes');
  readonly loadingLabel = input('Loading recipes…');

  protected skeletons(): readonly number[] {
    return Array.from({ length: Math.max(0, this.skeletonCount()) }, (_, index) => index);
  }
}

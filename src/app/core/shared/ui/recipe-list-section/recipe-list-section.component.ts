/**
 * Shared horizontal recipe-section presentation for Home Discover, Upcoming, and Favorites.
 * Route decisions and feature-specific messages remain with each composing feature.
 */
import { Component, input, output } from '@angular/core';

import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipeCardSkeletonComponent } from '../recipe-card-skeleton/recipe-card-skeleton.component';
import { RecipeCardComponent } from '../recipe-experience/recipe-card/recipe-card.component';

let nextHeadingId = 0;

@Component({
  selector: 'app-recipe-list-section',
  standalone: true,
  imports: [RecipeCardComponent, RecipeCardSkeletonComponent],
  templateUrl: './recipe-list-section.component.html',
  styleUrl: './recipe-list-section.component.scss',
})
export class RecipeListSectionComponent {
  readonly title = input.required<string>();
  readonly recipes = input<readonly RecipeCardDto[]>([]);
  readonly actionLabel = input('View all');
  readonly actionDisabled = input(false);
  readonly loading = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly emptyMessage = input<string | null>(null);
  readonly skeletonCount = input(4);
  readonly headingId = input(`recipe-list-section-${nextHeadingId++}`);
  readonly actionTriggered = output<void>();
  readonly retryRequested = output<void>();

  protected skeletons(): readonly number[] {
    return Array.from({ length: Math.max(0, this.skeletonCount()) }, (_, index) => index);
  }

  protected triggerAction(): void {
    if (!this.actionDisabled()) this.actionTriggered.emit();
  }
}

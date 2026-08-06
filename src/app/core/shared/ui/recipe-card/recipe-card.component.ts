import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { RecipeBadge, RecipeDifficulty } from '@app/core/shared/data-access/recipes/recipe.model';

export type RecipeCardMealType = 'prep' | 'day';

export interface RecipeCardData {
  id: number;
  name: string;
  mealType: RecipeCardMealType;
  imageUrl: string;
  prepTimeMinutes: number;
  servings: number;
  caloriesTotal: number;
  difficulty: RecipeDifficulty;
  badges: readonly RecipeBadge[];
  diets: readonly string[];
  isSaved: boolean;
  ownedIngredientCount: number;
  totalIngredientCount: number;
}

@Component({
  selector: 'app-recipe-card',
  standalone: true,
  templateUrl: './recipe-card.component.html',
  styleUrl: './recipe-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
})
export class RecipeCardComponent {
  readonly recipe = input.required<RecipeCardData>();
  readonly showIngredientMatch = input(false);

  readonly favoriteToggled = output<number>();

  protected readonly visibleTags = computed(() => {
    const recipe = this.recipe();
    const labels = [
      ...recipe.diets,
      ...recipe.badges.map((badge) => this.getBadgeLabel(badge)),
    ];

    return labels.slice(0, 2);
  });

  protected readonly ingredientMatch = computed(() => {
    const recipe = this.recipe();

    if (!this.showIngredientMatch() || recipe.totalIngredientCount <= 0) {
      return null;
    }

    return Math.round((recipe.ownedIngredientCount / recipe.totalIngredientCount) * 100);
  });

  protected get mealTypeLabel(): string {
    return this.recipe().mealType === 'prep' ? 'Prep Meal' : 'Day Meal';
  }

  protected onFavoriteClick(event: MouseEvent): void {
    event.stopPropagation();
    this.favoriteToggled.emit(this.recipe().id);
  }

  private getBadgeLabel(badge: RecipeBadge): string {
    switch (badge) {
      case 'freezer-friendly':
        return 'Freezer-friendly';
      case 'budget-focused':
        return 'Budget-focused';
      case 'high-protein':
        return 'High-protein';
    }
  }
}

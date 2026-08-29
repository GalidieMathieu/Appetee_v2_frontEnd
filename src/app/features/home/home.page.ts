/**
 * Home renders the public Recipe Card entry point without coordinating Preview or favorite UI.
 * Recommendation/search behavior remains unchanged and outside this shared-experience refactor.
 */
import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipeCardComponent } from '@app/core/shared/ui/recipe-experience/recipe-card/recipe-card.component';

type ViewFilter = 'all' | 'saved';
type MealTypeFilter = 'all' | 'prep' | 'day';

type FilterButton<T extends string> = {
  value: T;
  label: string;
  icon?: string;
};

@Component({
  selector: 'app-home-page',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [MatIconModule, RecipeCardComponent],
})
export class HomePageComponent {
  protected readonly ingredientCtaTitle = 'Tell us what ingredients you have';
  protected readonly ingredientCtaDescription = 'Help us recommend recipes you can make right now';
  protected readonly searchPlaceholder = 'Search recipes, ingredients...';
  protected readonly recipeCollectionTitle = 'Find More Recipes';
  protected readonly recipeCollectionDescription =
    'Browse our full collection of recipes tailored to your preferences.';

  protected readonly viewFilters: readonly FilterButton<ViewFilter>[] = [
    { value: 'all', label: 'All Recipes'},
    { value: 'saved', label: 'Saved (0)', icon: 'favorite_border' },
  ];

  protected selectedViewFilter: ViewFilter = 'all';

  protected readonly mealTypeFilters: readonly FilterButton<MealTypeFilter>[] = [
    { value: 'all', label: 'All Recipes' },
    { value: 'prep', label: 'Prep Meal (Batch Cooking)'},
    { value: 'day', label: 'Day Meal' },
  ];
  protected selectedMealTypeFilter: MealTypeFilter = 'all';

  protected readonly recipes: readonly RecipeCardDto[] = [
    {
      id: 4,
      name: 'Creamy Pasta Primavera',
      cardImageUrl:
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&h=340&fit=crop',
      totalTimeMinutes: 20,
      caloriesPerServing: 450,
      estimatedCostPerServing: 3.25,
      badges: ['Budget Friendly'],
      featuredIngredients: [
        { id: 1, name: 'Pasta', featuredOrder: 1 },
        { id: 2, name: 'Tomato', featuredOrder: 2 },
        { id: 3, name: 'Zucchini', featuredOrder: 3 },
      ],
      isSaved: false,
    },
  ];

  protected onIngredientCtaClick(): void {}

  protected onSearchInput(_event: Event): void {}

  protected onSearchSubmit(): void {}

  protected onViewFilterSelect(filter: ViewFilter): void {
    this.selectedViewFilter = filter;
  }

  protected onMealTypeFilterSelect(filter: MealTypeFilter): void {
    this.selectedMealTypeFilter = filter;
  }

  protected onExploreRecipesClick(): void {}
}

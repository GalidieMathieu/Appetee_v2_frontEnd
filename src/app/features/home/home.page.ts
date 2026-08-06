import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import {
  RecipeCardComponent,
  RecipeCardData,
} from '@app/core/shared/ui/recipe-card/recipe-card.component';

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

  protected readonly recipes: readonly RecipeCardData[] = [
    {
      id: 4,
      name: 'Creamy Pasta Primavera',
      mealType: 'day',
      imageUrl:
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&h=340&fit=crop',
      prepTimeMinutes: 20,
      servings: 3,
      caloriesTotal: 450,
      difficulty: 'Easy',
      badges: ['budget-focused'],
      diets: ['Vegetarian', 'Dairy-free'],
      isSaved: false,
      ownedIngredientCount: 0,
      totalIngredientCount: 4,
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

  protected onRecipeFavoriteToggle(_recipeId: number): void {}

  protected onExploreRecipesClick(): void {}
}

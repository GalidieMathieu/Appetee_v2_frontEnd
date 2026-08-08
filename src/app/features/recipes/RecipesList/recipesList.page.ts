import { Component, computed, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';

import { RecipeSummary } from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import {
  RecipeCardComponent,
  RecipeCardData,
  RecipeCardMealType,
} from '@app/core/shared/ui/recipe-card/recipe-card.component';

type ViewFilter = 'all' | 'saved';
type MealTypeFilter = 'all' | RecipeCardMealType;

type FilterButton<T extends string> = {
  value: T;
  label: string;
  icon?: string;
};

@Component({
  selector: 'app-recipes-list',
  templateUrl: './recipesList.page.html',
  styleUrls: ['./recipesList.page.scss'],
  standalone: true,
  imports: [MatIconModule, RecipeCardComponent],
})
export class RecipesListComponent implements OnInit {
  private readonly recipesFacade = inject(RecipesFacade);
  private readonly recipeSummaries = toSignal(this.recipesFacade.recipes$, { initialValue: [] });
  private readonly savedRecipeIds = signal<ReadonlySet<number>>(new Set());
  private readonly searchQuery = signal('');

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('resultsSection') private resultsSection?: ElementRef<HTMLElement>;

  protected readonly ingredientCtaTitle = 'Tell us what ingredients you have';
  protected readonly ingredientCtaDescription =
    'Help us recommend recipes you can make right now';
  protected readonly searchPlaceholder = 'Search recipes, ingredients...';
  protected readonly recipeCollectionTitle = 'Find More Recipes';
  protected readonly recipeCollectionDescription =
    'Browse our full collection of recipes tailored to your preferences.';

  protected readonly isLoading = toSignal(this.recipesFacade.isLoading$, { initialValue: false });
  protected readonly error = toSignal(this.recipesFacade.error$, { initialValue: null });

  protected readonly viewFilters = computed<readonly FilterButton<ViewFilter>[]>(() => [
    { value: 'all', label: 'All Recipes' },
    {
      value: 'saved',
      label: `Saved (${this.savedRecipeIds().size})`,
      icon: 'favorite_border',
    },
  ]);
  protected readonly selectedViewFilter = signal<ViewFilter>('all');

  protected readonly mealTypeFilters: readonly FilterButton<MealTypeFilter>[] = [
    { value: 'all', label: 'All Recipes' },
    { value: 'prep', label: 'Prep Meal (Batch Cooking)' },
    { value: 'day', label: 'Day Meal' },
  ];
  protected readonly selectedMealTypeFilter = signal<MealTypeFilter>('all');

  protected readonly recipes = computed<readonly RecipeCardData[]>(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase();
    const viewFilter = this.selectedViewFilter();
    const mealTypeFilter = this.selectedMealTypeFilter();
    const savedIds = this.savedRecipeIds();

    return this.recipeSummaries()
      .filter((recipe) => {
        if (viewFilter === 'saved' && !savedIds.has(recipe.id)) {
          return false;
        }

        const mealType = this.getMealType(recipe);
        if (mealTypeFilter !== 'all' && mealType !== mealTypeFilter) {
          return false;
        }

        if (!query) {
          return true;
        }

        const searchableText = [
          recipe.name,
          ...(recipe.ingredients ?? []).map((ingredient) => ingredient.name),
          ...(recipe.diets ?? []).map((diet) => diet.name),
          ...(recipe.badges ?? []),
        ]
          .join(' ')
          .toLocaleLowerCase();

        return searchableText.includes(query);
      })
      .map((recipe) => this.toCardData(recipe, savedIds));
  });

  ngOnInit(): void {
    this.recipesFacade.loadIfNeeded();
  }

  protected onIngredientCtaClick(): void {
    this.searchInput?.nativeElement.focus();
  }

  protected onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  protected onSearchSubmit(event: Event): void {
    event.preventDefault();
    this.resultsSection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected onViewFilterSelect(filter: ViewFilter): void {
    this.selectedViewFilter.set(filter);
  }

  protected onMealTypeFilterSelect(filter: MealTypeFilter): void {
    this.selectedMealTypeFilter.set(filter);
  }

  protected onRecipeFavoriteToggle(recipeId: number): void {
    this.savedRecipeIds.update((current) => {
      const next = new Set(current);
      next.has(recipeId) ? next.delete(recipeId) : next.add(recipeId);
      return next;
    });
  }

  protected onRetryClick(): void {
    this.recipesFacade.reload();
  }

  protected onExploreRecipesClick(): void {
    this.selectedViewFilter.set('all');
    this.selectedMealTypeFilter.set('all');
    this.searchQuery.set('');

    if (this.searchInput) {
      this.searchInput.nativeElement.value = '';
    }

    this.resultsSection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private toCardData(
    recipe: RecipeSummary,
    savedIds: ReadonlySet<number>
  ): RecipeCardData {
    return {
      id: recipe.id,
      name: recipe.name,
      mealType: this.getMealType(recipe),
      imageUrl: recipe.imageUrl ?? 'assets/icons/chef-hat.png',
      prepTimeMinutes: recipe.prepTimeMinutes,
      servings: recipe.servings,
      caloriesTotal: recipe.caloriesTotal,
      difficulty: recipe.difficulty,
      badges: recipe.badges ?? [],
      diets: (recipe.diets ?? []).map((diet) => diet.name),
      isSaved: savedIds.has(recipe.id),
      ownedIngredientCount: 0,
      totalIngredientCount: recipe.ingredients?.length ?? 0,
    };
  }

  private getMealType(recipe: RecipeSummary): RecipeCardMealType {
    return recipe.badges?.includes('freezer-friendly') ? 'prep' : 'day';
  }
}

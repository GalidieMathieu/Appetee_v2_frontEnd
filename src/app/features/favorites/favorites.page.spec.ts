/** Favorites page tests protect request-state rendering, navigation, retry, and shared Card reuse. */
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipeExperienceFacade } from '@app/core/shared/ui/recipe-experience/recipe-experience.facade';
import { FavoritesPageComponent } from './favorites.page';
import { FavoritesFacade } from './state/favorites.facade';

describe('FavoritesPageComponent', () => {
  const recipes = signal<readonly RecipeCardDto[]>([]);
  const isLoading = signal(false);
  const isLoaded = signal(false);
  const error = signal<string | null>(null);
  const loadIfNeeded = vi.fn();
  const retry = vi.fn();

  beforeEach(() => {
    recipes.set([]);
    isLoading.set(false);
    isLoaded.set(false);
    error.set(null);
    loadIfNeeded.mockReset();
    retry.mockReset();
    TestBed.configureTestingModule({
      imports: [FavoritesPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: FavoritesFacade,
          useValue: { recipes, isLoading, isLoaded, error, loadIfNeeded, retry },
        },
        {
          provide: RecipeExperienceFacade,
          useValue: {
            openPreview: vi.fn(),
            toggleFavorite: vi.fn(),
            favoriteSavedState: (_id: number, fallback: boolean) => fallback,
            isFavoritePending: () => false,
            favoriteFeedbackFor: () => null,
          },
        },
      ],
    });
  });

  it('loads on initialization and retains the semantic page heading', () => {
    const fixture = TestBed.createComponent(FavoritesPageComponent);
    fixture.detectChanges();

    expect(loadIfNeeded).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain(
      'Your Favorite Recipes'
    );
  });

  it('shows loading skeletons without a false empty state', () => {
    isLoading.set(true);
    const fixture = TestBed.createComponent(FavoritesPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.recipe-skeleton')).toHaveLength(8);
    expect(fixture.nativeElement.textContent).not.toContain("You haven't saved");
  });

  it('shows the approved empty state and semantic recipes navigation', () => {
    isLoaded.set(true);
    const fixture = TestBed.createComponent(FavoritesPageComponent);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a[routerlink="/recipes"]');
    expect(fixture.nativeElement.textContent).toContain("You haven't saved any recipes yet.");
    expect(link?.textContent).toContain('Explore Recipes');
  });

  it('renders populated results through shared Recipe Cards', () => {
    recipes.set([card(1), card(2)]);
    isLoaded.set(true);
    const fixture = TestBed.createComponent(FavoritesPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('app-recipe-card')).toHaveLength(2);
  });

  it('renders a retry action for errors without showing empty state', () => {
    error.set('Temporary failure');
    const fixture = TestBed.createComponent(FavoritesPageComponent);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(retry).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Temporary failure');
    expect(fixture.nativeElement.textContent).not.toContain("You haven't saved");
  });
});

function card(id: number): RecipeCardDto {
  return {
    id,
    name: `Recipe ${id}`,
    cardImageUrl: null,
    totalTimeMinutes: 30,
    caloriesPerServing: 400,
    estimatedCostPerServing: 3.5,
    badges: [],
    featuredIngredients: [],
    isSaved: true,
  };
}

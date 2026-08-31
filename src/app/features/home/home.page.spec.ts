/** Home tests protect live section composition, independent failures, and route ownership. */
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { UserFacade } from '@app/core/shared/data-access/user/user.facade';
import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipeExperienceFacade } from '@app/core/shared/ui/recipe-experience/recipe-experience.facade';
import { HOME_FEATURE_AVAILABILITY } from './home-feature-availability';
import { HomeFacade } from './state/home.facade';
import { HomePageComponent } from './home.page';

describe('HomePageComponent', () => {
  const navigate = vi.fn();
  const initialize = vi.fn();
  const retryDiscover = vi.fn();
  const retryFavorites = vi.fn();
  const openPreview = vi.fn();
  const toggleFavorite = vi.fn();
  let discoverRecipes = signal<readonly RecipeCardDto[]>([]);
  let favoriteRecipes = signal<readonly RecipeCardDto[]>([]);
  let isDiscoverLoading = signal(false);
  let isDiscoverLoaded = signal(true);
  let discoverError = signal<string | null>(null);
  let isFavoritesLoading = signal(false);
  let isFavoritesLoaded = signal(true);
  let favoritesError = signal<string | null>(null);

  beforeEach(() => {
    navigate.mockReset();
    navigate.mockResolvedValue(true);
    initialize.mockReset();
    retryDiscover.mockReset();
    retryFavorites.mockReset();
    openPreview.mockReset();
    toggleFavorite.mockReset();
    discoverRecipes = signal([]);
    favoriteRecipes = signal([]);
    isDiscoverLoading = signal(false);
    isDiscoverLoaded = signal(true);
    discoverError = signal(null);
    isFavoritesLoading = signal(false);
    isFavoritesLoaded = signal(true);
    favoritesError = signal(null);
    TestBed.configureTestingModule({
      imports: [HomePageComponent],
      providers: [
        { provide: Router, useValue: { navigate } },
        { provide: UserFacade, useValue: { username$: of('Alex') } },
        {
          provide: HomeFacade,
          useValue: {
            discoverRecipes,
            favoriteRecipes,
            isDiscoverLoading,
            isDiscoverLoaded,
            discoverError,
            isFavoritesLoading,
            isFavoritesLoaded,
            favoritesError,
            initialize,
            retryDiscover,
            retryFavorites,
          },
        },
        {
          provide: RecipeExperienceFacade,
          useValue: {
            openPreview,
            toggleFavorite,
            favoriteSavedState: (_id: number, fallback: boolean) => fallback,
            isFavoritePending: () => false,
            favoriteFeedbackFor: () => null,
          },
        },
      ],
    });
  });

  it('renders the approved welcome, Discover, no-plan, and final Explore structure', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent).toContain('Welcome back, Alex!');
    expect(root.textContent).toContain('What are we cooking today?');
    expect(root.querySelector('app-recipe-search-bar')).not.toBeNull();
    expect(root.querySelector('app-recipe-list-section')).not.toBeNull();
    expect(root.textContent).toContain('Discover');
    expect(root.textContent).toContain('Plan your meals for the week');
    expect(root.textContent).toContain('Looking for something else?');
    expect(root.querySelector('app-recipe-card')).toBeNull();
    expect(initialize).toHaveBeenCalledOnce();
  });

  it('routes a normalized search through Angular query params', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector('#recipe-search-input') as HTMLInputElement;
    input.value = '  rice   chicken  ';
    input.dispatchEvent(new Event('input'));

    (root.querySelector('.recipe-search-bar__submit') as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledWith(['/recipes'], {
      queryParams: { search: 'rice chicken' },
    });
  });

  it('does nothing for a whitespace-only search', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector('#recipe-search-input') as HTMLInputElement;
    input.value = '   ';
    input.dispatchEvent(new Event('input'));

    (root.querySelector('.recipe-search-bar__submit') as HTMLButtonElement).click();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('routes Discover View all and Explore All Recipes to the catalogue', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelector('.recipe-list-section__action') as HTMLButtonElement).click();
    (root.querySelector('.home-explore__action') as HTMLButtonElement).click();

    expect(navigate).toHaveBeenNthCalledWith(1, ['/recipes']);
    expect(navigate).toHaveBeenNthCalledWith(2, ['/recipes']);
  });

  it('keeps the unavailable Meal Plan action truly disabled and route-free', () => {
    const fixture = createFixture();
    const action = fixture.nativeElement.querySelector(
      '.meal-plan-empty-state__action'
    ) as HTMLButtonElement;

    expect(action.disabled).toBe(true);
    expect(action.getAttribute('aria-disabled')).toBe('true');
    action.click();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps a missing Favorites destination disabled and route-free', () => {
    TestBed.overrideProvider(HOME_FEATURE_AVAILABILITY, {
      useValue: { favoritesRoute: false, mealPlanRoute: false },
    });
    favoriteRecipes.set([card(4, true)]);
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const actions = root.querySelectorAll<HTMLButtonElement>(
      '.recipe-list-section__action'
    );

    expect(actions[1]?.disabled).toBe(true);
    expect(actions[1]?.getAttribute('aria-disabled')).toBe('true');
    actions[1]?.click();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('renders live Discover cards through the shared recipe section', () => {
    discoverRecipes.set([card(1), card(2)]);
    const fixture = createFixture();

    expect(fixture.nativeElement.querySelectorAll('app-recipe-card')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Recipe 1');
  });

  it('delegates Home card selection and heart clicks to the shared Recipe Experience', () => {
    discoverRecipes.set([card(7)]);
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelector('.recipe-card__selection') as HTMLElement).click();
    expect(openPreview).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));

    openPreview.mockClear();
    (root.querySelector('.recipe-card__favorite') as HTMLButtonElement).click();
    expect(toggleFavorite).toHaveBeenCalledWith(7, false);
    expect(openPreview).not.toHaveBeenCalled();
  });

  it('keeps search, Favorites, and Explore usable when Discover fails', () => {
    discoverError.set('Discover is unavailable.');
    favoriteRecipes.set([card(3, true)]);
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Discover is unavailable.');
    expect(root.textContent).toContain('Your Favorite Recipes');
    expect((root.querySelector('#recipe-search-input') as HTMLInputElement).disabled).toBe(false);
    expect((root.querySelector('.home-explore__action') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows Favorites only for loading, error, or a non-empty successful result', () => {
    const fixture = createFixture();
    expect(fixture.nativeElement.textContent).not.toContain('Your Favorite Recipes');

    favoritesError.set('Favorites could not be loaded.');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Your Favorite Recipes');
    expect(fixture.nativeElement.textContent).toContain('Favorites could not be loaded.');

    favoritesError.set(null);
    favoriteRecipes.set([card(4, true)]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Your Favorite Recipes');

    favoriteRecipes.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Your Favorite Recipes');
  });

  it('routes Favorites View all to the registered Favorites route', () => {
    favoriteRecipes.set([card(4, true)]);
    const fixture = createFixture();
    const actions = fixture.nativeElement.querySelectorAll('.recipe-list-section__action');

    (actions[1] as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledWith(['/favorites']);
  });

  it('uses one h1 followed by labeled h2 sections and accessible Home actions', () => {
    discoverRecipes.set([card(1)]);
    favoriteRecipes.set([card(2, true)]);
    const root = createFixture().nativeElement as HTMLElement;
    const headings = [...root.querySelectorAll('h1, h2')];

    expect(headings[0]?.tagName).toBe('H1');
    expect(headings.slice(1).every(heading => heading.tagName === 'H2')).toBe(true);
    expect(root.querySelector('label[for="recipe-search-input"]')?.textContent)
      .toContain('Search recipes');
    expect(root.querySelector('form[role="search"]')).not.toBeNull();
    expect(root.querySelector('section[aria-labelledby="home-explore-title"]')).not.toBeNull();
    expect(root.querySelectorAll('app-recipe-list-section')).toHaveLength(2);
  });
});

function createFixture() {
  const fixture = TestBed.createComponent(HomePageComponent);
  fixture.detectChanges();
  return fixture;
}

function card(id: number, isSaved = false): RecipeCardDto {
  return {
    id,
    name: `Recipe ${id}`,
    cardImageUrl: null,
    totalTimeMinutes: 30,
    caloriesPerServing: 400,
    estimatedCostPerServing: 3.5,
    badges: [],
    featuredIngredients: [],
    isSaved,
  };
}

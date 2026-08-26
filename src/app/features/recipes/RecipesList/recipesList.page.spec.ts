import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipeDiscoveryFacade } from '../state/recipe-discovery.facade';

import { RecipesListComponent } from './recipesList.page';

describe('RecipesListComponent', () => {
  const cards = signal<readonly RecipeCardDto[]>([]);
  const hasMore = signal(false);
  const isInitialLoading = signal(false);
  const initialError = signal<string | null>(null);
  const isLoadingMore = signal(false);
  const loadMoreError = signal<string | null>(null);
  const initialize = vi.fn();
  const retryInitial = vi.fn();
  const loadNextPage = vi.fn();
  const retryLoadMore = vi.fn();

  beforeEach(async () => {
    cards.set([]);
    hasMore.set(false);
    isInitialLoading.set(false);
    initialError.set(null);
    isLoadingMore.set(false);
    loadMoreError.set(null);
    initialize.mockReset();
    retryInitial.mockReset();
    loadNextPage.mockReset();
    retryLoadMore.mockReset();
    FakeIntersectionObserver.latest = null;
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);

    TestBed.configureTestingModule({
      imports: [RecipesListComponent],
      providers: [
        {
          provide: RecipeDiscoveryFacade,
          useValue: {
            cards,
            hasMore,
            isInitialLoading,
            initialError,
            isLoadingMore,
            loadMoreError,
            initialize,
            retryInitial,
            loadNextPage,
            retryLoadMore,
          },
        },
      ],
    });

    await TestBed.compileComponents();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows an initial skeleton grid distinct from loaded cards', () => {
    isInitialLoading.set(true);
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(initialize).toHaveBeenCalledOnce();
    expect(root.querySelectorAll('.recipe-skeleton')).toHaveLength(8);
    expect(root.querySelector('app-recipe-card')).toBeNull();
    expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('renders up to 20 first-page cards and keeps initial visible images eager', () => {
    cards.set(Array.from({ length: 20 }, (_, index) => card(index + 1)));
    hasMore.set(true);
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const images = root.querySelectorAll<HTMLImageElement>('.recipe-card__image');

    expect(root.querySelectorAll('app-recipe-card')).toHaveLength(20);
    expect(root.textContent).toContain('20 recipes loaded');
    expect(images[0]?.getAttribute('loading')).toBe('eager');
    expect(images[3]?.getAttribute('loading')).toBe('eager');
    expect(images[4]?.getAttribute('loading')).toBe('lazy');
    expect(root.textContent).toContain('Load more recipes');
  });

  it('uses IntersectionObserver and the explicit button for the same next-page path', () => {
    cards.set([card(1)]);
    hasMore.set(true);
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(FakeIntersectionObserver.latest?.observe).toHaveBeenCalledOnce();
    FakeIntersectionObserver.latest?.trigger(true);
    (root.querySelector('.recipe-results__load-button') as HTMLButtonElement).click();

    expect(loadNextPage).toHaveBeenCalledTimes(2);
  });

  it('keeps existing cards visible and retries after a load-more failure', () => {
    cards.set([card(1), card(2)]);
    hasMore.set(true);
    loadMoreError.set('Could not load more recipes.');
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('app-recipe-card')).toHaveLength(2);
    expect(root.textContent).toContain('Could not load more recipes.');
    (root.querySelector('.recipe-results__load-button') as HTMLButtonElement).click();
    expect(retryLoadMore).toHaveBeenCalledOnce();
  });

  it('shows the end state and removes continuation triggers when no page remains', () => {
    cards.set([card(1)]);
    hasMore.set(false);
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('reached the end');
    expect(root.querySelector('.recipe-results__load-button')).toBeNull();
    expect(root.querySelector('.recipe-results__sentinel')).toBeNull();
  });

  it('renders initial error/retry and compatible-empty states', () => {
    initialError.set('Cannot reach the server.');
    const errorFixture = createFixture();
    const errorRoot = errorFixture.nativeElement as HTMLElement;
    expect(errorRoot.textContent).toContain('Cannot reach the server.');
    (errorRoot.querySelector('.recipe-results__action') as HTMLButtonElement).click();
    expect(retryInitial).toHaveBeenCalledOnce();

    initialError.set(null);
    errorFixture.detectChanges();
    expect(errorRoot.textContent).toContain('No compatible recipes available');
  });
});

function createFixture() {
  const fixture = TestBed.createComponent(RecipesListComponent);
  fixture.detectChanges();
  return fixture;
}

function card(id: number): RecipeCardDto {
  return {
    id,
    name: `Recipe ${id}`,
    cardImageUrl: `https://cdn.example.com/cards/${id}.jpg`,
    totalTimeMinutes: 35,
    caloriesPerServing: 451,
    estimatedCostPerServing: 1.72,
    badges: ['High Protein', 'Meal Prep'],
    featuredIngredients: [
      { id: 100 + id, name: 'Chicken', featuredOrder: 1 },
      { id: 200 + id, name: 'Quinoa', featuredOrder: 2 },
    ],
    isSaved: false,
  };
}

class FakeIntersectionObserver {
  static latest: FakeIntersectionObserver | null = null;

  readonly observe = vi.fn();
  readonly disconnect = vi.fn();

  constructor(
    private readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit
  ) {
    FakeIntersectionObserver.latest = this;
  }

  trigger(isIntersecting: boolean): void {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

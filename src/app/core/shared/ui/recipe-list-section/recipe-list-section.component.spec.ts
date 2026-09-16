/** Shared recipe-section tests protect card-only composition, loading, and action ownership. */
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipeExperienceFacade } from '../recipe-experience/recipe-experience.facade';
import { RecipeListSectionComponent } from './recipe-list-section.component';

describe('RecipeListSectionComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RecipeListSectionComponent],
      providers: [{
        provide: RecipeExperienceFacade,
        useValue: {
          openPreview: vi.fn(),
          toggleFavorite: vi.fn(),
          favoriteSavedState: (_id: number, fallback: boolean) => fallback,
          isFavoritePending: () => false,
          favoriteFeedbackFor: () => null,
        },
      }],
    });
  });

  it('renders its supplied title and canonical Recipe Cards in a contained horizontal row', () => {
    const fixture = createFixture([card(1), card(2)]);
    const row = fixture.nativeElement.querySelector('.recipe-list-section__row') as HTMLElement;

    expect(fixture.nativeElement.querySelector('h2')?.textContent).toContain('Discover');
    expect(fixture.nativeElement.querySelectorAll('app-recipe-card')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('app-recipe-quick-preview')).toBeNull();
    expect(getComputedStyle(row).overflowX).toBe('auto');
  });

  it('emits its route-free action once and respects native disabled semantics', () => {
    const fixture = createFixture([]);
    const triggered = vi.fn();
    fixture.componentInstance.actionTriggered.subscribe(triggered);
    const action = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(action.getAttribute('aria-label')).toBe('View all Discover');
    action.click();
    expect(triggered).toHaveBeenCalledOnce();

    fixture.componentRef.setInput('actionDisabled', true);
    fixture.detectChanges();
    action.click();
    expect(action.disabled).toBe(true);
    expect(action.getAttribute('aria-disabled')).toBe('true');
    expect(triggered).toHaveBeenCalledOnce();
  });

  it.each([1, 2, 4, 5])('keeps %i canonical cards in the same contained row', count => {
    const fixture = createFixture(Array.from({ length: count }, (_, index) => card(index + 1)));
    const section = fixture.nativeElement.querySelector('section') as HTMLElement;
    const row = fixture.nativeElement.querySelector('.recipe-list-section__row') as HTMLElement;

    expect(fixture.nativeElement.querySelectorAll('app-recipe-card')).toHaveLength(count);
    expect(section.getAttribute('aria-labelledby')).toBe(
      fixture.nativeElement.querySelector('h2')?.id
    );
    expect(getComputedStyle(row).overflowX).toBe('auto');
    expect(getComputedStyle(row).maxWidth).toBe('100%');
  });

  it('leaves long-title height constraints to the canonical Recipe Card', () => {
    const fixture = createFixture([{
      ...card(1),
      name: 'A deliberately long recipe title that must remain constrained inside the shared card',
    }]);
    const title = fixture.nativeElement.querySelector('.recipe-card__title') as HTMLElement;

    expect(getComputedStyle(title).overflow).toBe('hidden');
    expect(getComputedStyle(title).webkitLineClamp).toBe('2');
  });

  it('renders shared card-footprint skeletons while loading', () => {
    const fixture = TestBed.createComponent(RecipeListSectionComponent);
    fixture.componentRef.setInput('title', 'Discover');
    fixture.componentRef.setInput('recipes', [card(1)]);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.recipe-skeleton')).toHaveLength(4);
    expect(fixture.nativeElement.querySelector('app-recipe-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('renders a local error with retry instead of treating it as empty', () => {
    const fixture = createFixture([]);
    const retry = vi.fn();
    fixture.componentInstance.retryRequested.subscribe(retry);
    fixture.componentRef.setInput('errorMessage', 'Discover could not be loaded.');
    fixture.componentRef.setInput('emptyMessage', 'Nothing here.');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('Discover could not be loaded.');
    expect(fixture.nativeElement.textContent).not.toContain('Nothing here.');
    const retryAction = fixture.nativeElement.querySelector(
      '.recipe-list-section__retry'
    ) as HTMLButtonElement;
    expect(retryAction.getAttribute('aria-label')).toBe('Try Discover again');
    retryAction.click();
    expect(retry).toHaveBeenCalledOnce();
  });
});

function createFixture(recipes: readonly RecipeCardDto[]) {
  const fixture = TestBed.createComponent(RecipeListSectionComponent);
  fixture.componentRef.setInput('title', 'Discover');
  fixture.componentRef.setInput('recipes', recipes);
  fixture.detectChanges();
  return fixture;
}

function card(id: number): RecipeCardDto {
  return {
    id,
    name: `Recipe ${id}`,
    cardImageUrl: null,
    totalTimeMinutes: 30,
    caloriesPerServing: 400,
    estimatedCostPerServing: 3.5,
    badges: ['Quick Meal'],
    featuredIngredients: [],
    isSaved: false,
  };
}

/** Shared grid tests protect responsive Card reuse and accessible skeleton presentation. */
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipeExperienceFacade } from '../recipe-experience/recipe-experience.facade';
import { RecipeCardGridComponent } from './recipe-card-grid.component';

describe('RecipeCardGridComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RecipeCardGridComponent],
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

  it('renders the canonical shared Recipe Card once per supplied projection', () => {
    const fixture = TestBed.createComponent(RecipeCardGridComponent);
    fixture.componentRef.setInput('recipes', [card(1), card(2)]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('app-recipe-card')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('.recipe-card')).toHaveLength(2);
  });

  it('renders grid-compatible skeletons without recipe cards while loading', () => {
    const fixture = TestBed.createComponent(RecipeCardGridComponent);
    fixture.componentRef.setInput('recipes', []);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const grid = fixture.nativeElement.querySelector('.recipe-card-grid');
    expect(grid.getAttribute('role')).toBe('status');
    expect(grid.getAttribute('aria-busy')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('.recipe-skeleton')).toHaveLength(8);
    expect(fixture.nativeElement.querySelector('app-recipe-card')).toBeNull();
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
    badges: ['Quick Meal'],
    featuredIngredients: [],
    isSaved: true,
  };
}

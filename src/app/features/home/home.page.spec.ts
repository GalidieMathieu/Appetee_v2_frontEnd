/**
 * Home coverage verifies it provides only Card data while the shared experience owns selection.
 * Recommendation behavior remains outside this architecture regression boundary.
 */
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { RecipeExperienceFacade } from '@app/core/shared/ui/recipe-experience/recipe-experience.facade';

import { HomePageComponent } from './home.page';

describe('HomePageComponent Quick Preview integration', () => {
  it('opens the shared Preview with the selected Home card', () => {
    const openPreview = vi.fn();
    TestBed.configureTestingModule({
      imports: [HomePageComponent],
      providers: [
        {
          provide: RecipeExperienceFacade,
          useValue: {
            openPreview,
            toggleFavorite: vi.fn(),
            favoriteSavedState: (_recipeId: number, fallback: boolean) => fallback,
            isFavoritePending: () => false,
            favoriteFeedbackFor: () => null,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(HomePageComponent);
    fixture.detectChanges();

    const selection = fixture.nativeElement.querySelector(
      '.recipe-card__selection'
    ) as HTMLElement;
    selection.click();

    expect(openPreview).toHaveBeenCalledOnce();
    expect(openPreview.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      id: 4,
      name: 'Creamy Pasta Primavera',
    }));
  });
});

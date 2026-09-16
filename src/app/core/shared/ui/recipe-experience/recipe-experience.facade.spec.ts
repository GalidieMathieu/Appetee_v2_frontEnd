/**
 * Recipe Experience tests protect exact Cooking entry/return, trusted history, scroll restoration,
 * active-dialog ownership, identity reset, and data-access delegation.
 */
import { Location, ViewportScroller } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';

import { RecipeExperienceFacade } from './recipe-experience.facade';
import { RecipeQuickPreviewComponent } from './recipe-quick-preview/recipe-quick-preview.component';

describe('RecipeExperienceFacade', () => {
  const routerEvents = new Subject<NavigationEnd>();
  const dialogClosed = new Subject<void>();
  const frameCallbacks: FrameRequestCallback[] = [];
  const close = vi.fn();
  const open = vi.fn();
  const navigateByUrl = vi.fn(() => Promise.resolve(true));
  const back = vi.fn();
  const getScrollPosition = vi.fn<() => [number, number]>(() => [0, 640]);
  const scrollToPosition = vi.fn();
  const toggleFavorite = vi.fn();
  const favoriteSavedState = vi.fn();
  const isFavoritePending = vi.fn();
  const favoriteFeedback = signal<{ recipeId: number; message: string } | null>(null);
  let routerUrl = '/recipes?search=chicken&badges=High%20Protein';

  beforeEach(() => {
    routerUrl = '/recipes?search=chicken&badges=High%20Protein';
    frameCallbacks.length = 0;
    close.mockReset();
    open.mockReset();
    open.mockReturnValue({
      close,
      afterClosed: () => dialogClosed.asObservable(),
    });
    navigateByUrl.mockClear();
    back.mockReset();
    getScrollPosition.mockClear();
    scrollToPosition.mockReset();
    toggleFavorite.mockReset();
    favoriteSavedState.mockReset();
    isFavoritePending.mockReset();
    favoriteFeedback.set(null);
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    TestBed.configureTestingModule({
      providers: [
        RecipeExperienceFacade,
        { provide: MatDialog, useValue: { open } },
        {
          provide: Router,
          useValue: {
            get url() { return routerUrl; },
            events: routerEvents.asObservable(),
            navigateByUrl,
          },
        },
        { provide: Location, useValue: { back } },
        { provide: ViewportScroller, useValue: { getScrollPosition, scrollToPosition } },
        {
          provide: RecipesFacade,
          useValue: {
            toggleFavorite,
            favoriteSavedState,
            isFavoritePending,
            favoriteFeedback,
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens shared Preview with a Cooking callback and focus restoration', () => {
    const card = createCard();

    TestBed.inject(RecipeExperienceFacade).openPreview(card);

    expect(open).toHaveBeenCalledWith(
      RecipeQuickPreviewComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          recipeId: card.id,
          card,
          startCooking: expect.any(Function),
        }),
        panelClass: 'recipe-quick-preview-panel',
        restoreFocus: true,
      })
    );
  });

  it('captures exact query and scroll, closes only Preview, and navigates once', () => {
    const facade = TestBed.inject(RecipeExperienceFacade);
    facade.openPreview(createCard());

    previewStartCooking()();

    expect(getScrollPosition).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(navigateByUrl).toHaveBeenCalledOnce();
    expect(navigateByUrl).toHaveBeenCalledWith('/recipes/12/cooking');

    facade.exitCookingMode();
    expect(back).toHaveBeenCalledOnce();
    routerEvents.next(new NavigationEnd(2, '/recipes/12/cooking', routerUrl));
    runRenderFrames();
    expect(scrollToPosition).toHaveBeenCalledWith([0, 640]);
  });

  it('consumes valid return context and disposes its one-shot listener', () => {
    const facade = TestBed.inject(RecipeExperienceFacade);
    facade.openPreview(createCard());
    previewStartCooking()();

    facade.exitCookingMode();
    expect(routerEvents.observed).toBe(true);
    routerEvents.next(new NavigationEnd(2, '/recipes/12/cooking', routerUrl));
    expect(routerEvents.observed).toBe(false);

    facade.exitCookingMode();
    expect(navigateByUrl).toHaveBeenLastCalledWith('/recipes');
    expect(back).toHaveBeenCalledOnce();
  });

  it('supports native browser Back with the same one-shot restoration', () => {
    const facade = TestBed.inject(RecipeExperienceFacade);
    facade.openPreview(createCard());
    previewStartCooking()();

    routerEvents.next(new NavigationEnd(2, '/recipes/12/cooking', routerUrl));
    expect(routerEvents.observed).toBe(false);
    runRenderFrames();

    expect(scrollToPosition).toHaveBeenCalledWith([0, 640]);
    facade.exitCookingMode();
    expect(navigateByUrl).toHaveBeenLastCalledWith('/recipes');
  });

  it('uses the safe Recipes fallback for a direct Cooking URL', () => {
    const facade = TestBed.inject(RecipeExperienceFacade);

    facade.exitCookingMode();

    expect(navigateByUrl).toHaveBeenCalledWith('/recipes');
    expect(back).not.toHaveBeenCalled();
  });

  it('rejects a protocol-relative return URL instead of sending history back', () => {
    routerUrl = '//evil.example/steal';
    const facade = TestBed.inject(RecipeExperienceFacade);
    facade.openPreview(createCard());
    previewStartCooking()();

    facade.exitCookingMode();

    expect(navigateByUrl).toHaveBeenNthCalledWith(1, '/recipes/12/cooking');
    expect(navigateByUrl).toHaveBeenNthCalledWith(2, '/recipes');
    expect(back).not.toHaveBeenCalled();
  });

  it('identity reset clears return context and disposes pending restoration', () => {
    const facade = TestBed.inject(RecipeExperienceFacade);
    facade.openPreview(createCard());
    previewStartCooking()();
    facade.exitCookingMode();
    expect(routerEvents.observed).toBe(true);

    facade.reset();

    expect(routerEvents.observed).toBe(false);
    routerEvents.next(new NavigationEnd(3, '/recipes/12/cooking', routerUrl));
    expect(scrollToPosition).not.toHaveBeenCalled();
  });

  it('delegates favorite state and mutation without owning data behavior', () => {
    favoriteSavedState.mockReturnValue(true);
    isFavoritePending.mockReturnValue(false);
    const facade = TestBed.inject(RecipeExperienceFacade);

    facade.toggleFavorite(12, false);

    expect(toggleFavorite).toHaveBeenCalledWith(12, false);
    expect(facade.favoriteSavedState(12, false)).toBe(true);
    expect(facade.isFavoritePending(12)).toBe(false);
  });

  function previewStartCooking(): () => void {
    const options = open.mock.calls[0]?.[1] as {
      data: { startCooking: () => void };
    };
    return options.data.startCooking;
  }

  function runRenderFrames(): void {
    frameCallbacks.shift()?.(0);
    frameCallbacks.shift()?.(0);
  }
});

function createCard(): RecipeCardDto {
  return {
    id: 12,
    name: 'Fast Chicken Bowl',
    cardImageUrl: 'https://cdn.example.com/cards/12.jpg',
    totalTimeMinutes: 30,
    caloriesPerServing: 420,
    estimatedCostPerServing: 2.5,
    badges: ['High Protein'],
    featuredIngredients: [],
    isSaved: false,
  };
}

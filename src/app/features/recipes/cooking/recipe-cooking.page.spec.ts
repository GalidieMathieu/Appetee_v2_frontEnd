/**
 * Cooking route-container tests protect ID parsing, facade-only loading, retry, and shared exit.
 * Shared cooking interactions are intentionally covered by the presentation component suite.
 */
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { EMPTY } from 'rxjs';
import { vi } from 'vitest';

import { EntityRequestState } from '@app/core/shared/data-access/generic-template/entity-cache-store';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { RecipeCookingViewDto } from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipeExperienceFacade } from '@app/core/shared/ui/recipe-experience/recipe-experience.facade';
import { RecipeCookingPageComponent } from './recipe-cooking.page';

describe('RecipeCookingPageComponent', () => {
  it('loads a valid route ID through RecipesFacade and renders shared Cooking Mode', () => {
    const harness = createHarness('42', cookingView(), { status: 'success', error: null });

    expect(harness.getCookingView).toHaveBeenCalledWith(42);
    expect(harness.root.querySelector('app-recipe-cooking-mode')).not.toBeNull();
    expect(harness.root.textContent).toContain('Chicken Rice Bowl');
  });

  it('renders a responsive initial skeleton while the cache request is loading', () => {
    const harness = createHarness('42', null, { status: 'loading', error: null });

    expect(harness.root.querySelector('.recipe-cooking-page__loading')).not.toBeNull();
    expect(harness.root.textContent).toContain('Loading Cooking Mode');
  });

  it('renders the dedicated unavailable state for a 404 without offering retry', () => {
    const harness = createHarness('42', null, {
      status: 'error',
      error: 'The requested resource was not found.',
      httpStatus: 404,
    });

    expect(harness.root.textContent).toContain('Cooking session unavailable');
    expect(harness.root.textContent).not.toContain('Try again');
  });

  it('retries a recoverable load error through the facade', () => {
    const harness = createHarness('42', null, {
      status: 'error',
      error: 'Cannot reach the server.',
    });

    button(harness.root, 'Try again').click();
    expect(harness.retryCookingView).toHaveBeenCalledWith(42);
  });

  it('rejects a noncanonical route ID without making an API-backed load', () => {
    const harness = createHarness('42abc', null, { status: 'idle', error: null });

    expect(harness.getCookingView).not.toHaveBeenCalled();
    expect(harness.root.textContent).toContain('Cooking session unavailable');
  });

  it('delegates exit to the shared Recipe Experience return flow', () => {
    const harness = createHarness('42', cookingView(), { status: 'success', error: null });

    button(harness.root, 'Exit Cooking Mode').click();
    expect(harness.exitCookingMode).toHaveBeenCalledOnce();
  });
});

interface Harness {
  readonly fixture: ComponentFixture<RecipeCookingPageComponent>;
  readonly root: HTMLElement;
  readonly getCookingView: ReturnType<typeof vi.fn>;
  readonly retryCookingView: ReturnType<typeof vi.fn>;
  readonly exitCookingMode: ReturnType<typeof vi.fn>;
}

function createHarness(
  id: string,
  view: RecipeCookingViewDto | null,
  state: EntityRequestState
): Harness {
  const viewSignal = signal(view);
  const stateSignal = signal(state);
  const getCookingView = vi.fn(() => EMPTY);
  const retryCookingView = vi.fn(() => EMPTY);
  const exitCookingMode = vi.fn();

  TestBed.configureTestingModule({
    imports: [RecipeCookingPageComponent],
    providers: [
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id }) } },
      },
      { provide: RecipeExperienceFacade, useValue: { exitCookingMode } },
      {
        provide: RecipesFacade,
        useValue: {
          cookingViewFor: vi.fn(() => viewSignal.asReadonly()),
          cookingViewRequestState: vi.fn(() => stateSignal.asReadonly()),
          getCookingView,
          retryCookingView,
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(RecipeCookingPageComponent);
  fixture.detectChanges();
  return {
    fixture,
    root: fixture.nativeElement as HTMLElement,
    getCookingView,
    retryCookingView,
    exitCookingMode,
  };
}

function cookingView(): RecipeCookingViewDto {
  return {
    id: 42,
    name: 'Chicken Rice Bowl',
    imageUrl: null,
    description: 'A complete recipe.',
    totalTimeMinutes: 35,
    baseServings: 4,
    caloriesTotal: 800,
    proteinTotal: 40,
    carbsTotal: 100,
    badges: ['High Protein'],
    ingredients: [{ id: 7, name: 'Rice', quantity: 200, unit: 'g', displayOrder: 1 }],
    steps: [{ order: 1, title: 'Cook', instruction: 'Cook until ready.' }],
  };
}

function button(root: HTMLElement, label: string): HTMLButtonElement {
  const result = Array.from(root.querySelectorAll('button'))
    .find(candidate => candidate.textContent?.trim().includes(label));
  if (!result) throw new Error(`Button "${label}" was not found.`);
  return result;
}

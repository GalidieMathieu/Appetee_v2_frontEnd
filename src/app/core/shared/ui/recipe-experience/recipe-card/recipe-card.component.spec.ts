/*
 * Recipe-experience Card tests protect canonical rendering and direct Preview/favorite delegation.
 * Feature consumers must not recreate these interactions through output bindings.
 */
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipeExperienceFacade } from '../recipe-experience.facade';

import { RecipeCardComponent } from './recipe-card.component';

describe('RecipeCardComponent', () => {
  const openPreview = vi.fn();
  const toggleFavorite = vi.fn();
  const favoriteSavedState = vi.fn((_id: number, fallback: boolean) => fallback);
  const isFavoritePending = vi.fn(() => false);
  const favoriteFeedbackFor = vi.fn(() => null);

  beforeEach(async () => {
    openPreview.mockReset();
    toggleFavorite.mockReset();
    favoriteSavedState.mockClear();
    isFavoritePending.mockReset();
    isFavoritePending.mockReturnValue(false);
    favoriteFeedbackFor.mockReset();
    favoriteFeedbackFor.mockReturnValue(null);
    await TestBed.configureTestingModule({
      imports: [RecipeCardComponent],
      providers: [{
        provide: RecipeExperienceFacade,
        useValue: {
          openPreview,
          toggleFavorite,
          favoriteSavedState,
          isFavoritePending,
          favoriteFeedbackFor,
        },
      }],
    }).compileComponents();
  });

  it('renders only canonical card fields in fixed single-row regions', () => {
    const fixture = createFixture(createCard());
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('A deliberately long recipe title');
    expect(root.textContent).toContain('35 min');
    expect(root.textContent).toContain('451 cal');
    expect(root.textContent).toContain('$1.72');
    expect(root.textContent).toContain('High Protein');
    expect(root.textContent).toContain('Chicken');
    expect(root.textContent).not.toContain('serving');
    expect(root.textContent).not.toContain('difficulty');
    expect(root.textContent).not.toContain('meal type');

    const cardStyle = getComputedStyle(root.querySelector('.recipe-card')!);
    const hostStyle = getComputedStyle(root);
    const badgesStyle = getComputedStyle(root.querySelector('.recipe-card__badge-row')!);
    const ingredientsStyle = getComputedStyle(root.querySelector('.recipe-card__featured')!);
    const metaItemStyle = getComputedStyle(root.querySelector('.recipe-card__meta > span')!);
    const badgeStyle = getComputedStyle(root.querySelector('.recipe-card__badge')!);
    const ingredientStyle = getComputedStyle(root.querySelector('.recipe-card__ingredient')!);
    expect(cardStyle.height).toBe('var(--recipe-card-height, 20rem)');
    expect(hostStyle.display).toBe('block');
    expect(hostStyle.width).toBe('100%');
    expect(badgesStyle.flexWrap).toBe('nowrap');
    expect(badgesStyle.justifyContent).toBe('flex-start');
    expect(ingredientsStyle.flexWrap).toBe('nowrap');
    expect(ingredientsStyle.justifyContent).toBe('flex-start');
    expect(metaItemStyle.justifyContent).toBe('center');
    expect(badgeStyle.flexShrink).toBe('1');
    expect(ingredientStyle.flexShrink).toBe('1');
    expect(root.querySelectorAll('.recipe-card__badge')).toHaveLength(3);
    expect(root.querySelectorAll('.recipe-card__ingredient')).toHaveLength(3);
  });

  it('shows the largest badge and ingredient prefix that fits the card width', () => {
    const fixture = createFixture(createCard());
    const root = fixture.nativeElement as HTMLElement;
    const badgeRow = root.querySelector('.recipe-card__badge-row') as HTMLElement;
    const ingredientRow = root.querySelector('.recipe-card__featured') as HTMLElement;
    const badges = [...root.querySelectorAll<HTMLElement>('.recipe-card__badge')];
    const ingredients = [...root.querySelectorAll<HTMLElement>('.recipe-card__ingredient')];

    defineWidth(badgeRow, 'clientWidth', 175);
    defineWidth(ingredientRow, 'clientWidth', 175);
    badges.forEach(chip => defineWidth(chip, 'scrollWidth', 50));
    ingredients.forEach(chip => defineWidth(chip, 'scrollWidth', 80));

    const measurableComponent = fixture.componentInstance as unknown as {
      recalculateVisibleItems(): void;
    };
    measurableComponent.recalculateVisibleItems();
    fixture.detectChanges();

    expect(visibleChips(badges)).toHaveLength(3);
    expect(visibleChips(ingredients)).toHaveLength(2);

    defineWidth(ingredientRow, 'clientWidth', 260);
    measurableComponent.recalculateVisibleItems();
    fixture.detectChanges();

    expect(visibleChips(ingredients)).toHaveLength(3);
  });

  it('opens Preview directly for click, Enter, and Space', () => {
    const fixture = createFixture(createCard());
    const selection = fixture.nativeElement.querySelector(
      '.recipe-card__selection'
    ) as HTMLElement;

    selection.click();
    selection.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    selection.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(openPreview).toHaveBeenCalledTimes(3);
    expect(openPreview).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 42, isSaved: false })
    );
  });

  it('keeps favorite activation independent from card selection', () => {
    const fixture = createFixture(createCard());

    (fixture.nativeElement.querySelector('.recipe-card__favorite') as HTMLButtonElement).click();

    expect(toggleFavorite).toHaveBeenCalledWith(42, false);
    expect(openPreview).not.toHaveBeenCalled();
  });

  it('disables favorite activation while that recipe mutation is pending', () => {
    isFavoritePending.mockReturnValue(true);
    const fixture = createFixture(createCard());
    const button = fixture.nativeElement.querySelector(
      '.recipe-card__favorite'
    ) as HTMLButtonElement;

    button.click();

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toContain('hourglass_top');
    expect(toggleFavorite).not.toHaveBeenCalled();
  });

  it('uses the placeholder for a null image and respects requested loading priority', () => {
    const fixture = createFixture({ ...createCard(), cardImageUrl: null }, 'eager');
    const image = fixture.nativeElement.querySelector('.recipe-card__image') as HTMLImageElement;

    expect(image.getAttribute('src')).toBe('assets/icons/chef-hat.png');
    expect(image.getAttribute('loading')).toBe('eager');
  });
});

function createFixture(recipe: RecipeCardDto, imageLoading: 'eager' | 'lazy' = 'lazy') {
  const fixture = TestBed.createComponent(RecipeCardComponent);
  fixture.componentRef.setInput('recipe', recipe);
  fixture.componentRef.setInput('imageLoading', imageLoading);
  fixture.detectChanges();
  return fixture;
}

function createCard(): RecipeCardDto {
  return {
    id: 42,
    name: 'A deliberately long recipe title that must never resize the card unexpectedly',
    cardImageUrl: 'https://cdn.example.com/cards/recipe.jpg',
    totalTimeMinutes: 35,
    caloriesPerServing: 451,
    estimatedCostPerServing: 1.72,
    badges: ['High Protein', 'Meal Prep', 'Budget Friendly', 'Few Ingredients'],
    featuredIngredients: [
      { id: 4, name: 'Quinoa', featuredOrder: 2 },
      { id: 3, name: 'Chicken', featuredOrder: 1 },
      { id: 5, name: 'Black beans', featuredOrder: 3 },
      { id: 6, name: 'Overflow ingredient', featuredOrder: 3 },
    ],
    isSaved: false,
  };
}

function defineWidth(element: HTMLElement, property: 'clientWidth' | 'scrollWidth', value: number) {
  Object.defineProperty(element, property, { configurable: true, value });
}

function visibleChips(chips: HTMLElement[]): HTMLElement[] {
  return chips.filter(chip => chip.getAttribute('aria-hidden') !== 'true');
}

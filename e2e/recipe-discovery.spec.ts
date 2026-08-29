/**
 * Browser-level F-008 regression coverage for discovery, applied URL criteria, shared Preview,
 * favorite synchronization, and the explicit cursor-continuation fallback without a real backend.
 */
import { expect, test } from '@playwright/test';

// Match either development or production API hosts because Playwright may reuse an existing
// Angular server whose environment configuration differs from the server it would start itself.
const API_PATTERN = '**/api/**';

test('search, filters, shared Preview, and favorite membership stay in one SPA flow', async ({
  page,
}) => {
  const discoveryUrls: URL[] = [];
  let saveRequests = 0;
  let removeRequests = 0;

  await page.route(API_PATTERN, async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/api/auth/session' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ userId: 42, username: 'recipe-tester' }),
      });
      return;
    }

    if (url.pathname === '/api/users/me' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ username: 'recipe-tester', imageUrl: null }),
      });
      return;
    }

    if (url.pathname === '/api/ingredients' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 7, name: 'Boneless Skinless Chicken Breast' },
        ]),
      });
      return;
    }

    if (url.pathname === '/api/recipes/12/preview' && request.method() === 'GET') {
      await new Promise(resolve => setTimeout(resolve, 600));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(preview()),
      });
      return;
    }

    if (url.pathname === '/api/recipes/12/favorite' && request.method() === 'PUT') {
      saveRequests += 1;
      await route.fulfill({ status: 204 });
      return;
    }

    if (url.pathname === '/api/recipes/12/favorite' && request.method() === 'DELETE') {
      removeRequests += 1;
      await route.fulfill({ status: 204 });
      return;
    }

    if (url.pathname === '/api/recipes' && request.method() === 'GET') {
      discoveryUrls.push(url);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [card(12)], nextCursor: null, hasMore: false }),
      });
      return;
    }

    await route.abort('failed');
  });

  await page.goto('/recipes');
  await expect(page.getByRole('heading', { name: 'Browse compatible recipes' })).toBeVisible();
  await expect(page.getByText('Chicken Power Bowl', { exact: true })).toBeVisible();
  expect(discoveryUrls).toHaveLength(1);

  const search = page.getByLabel('Search recipes by recipe or ingredient name');
  await search.fill('chicken');
  expect(discoveryUrls).toHaveLength(1);
  await search.press('Enter');
  await expect(page).toHaveURL(/search=chicken/);
  await expect.poll(() => discoveryUrls.length).toBe(2);

  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByRole('combobox', { name: 'Ingredients', exact: true }).fill('chi');
  await page.getByRole('option', { name: 'Boneless Skinless Chicken Breast' }).click();
  await page.getByRole('button', { name: 'High Protein', exact: true }).click();
  await page.getByRole('switch', { name: 'Saved recipes only' }).click();
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page).toHaveURL(/ingredientIds=7/);
  await expect(page).toHaveURL(/badges=High(?:%20|\+)Protein/);
  await expect(page).toHaveURL(/savedOnly=true/);
  await expect(page.getByRole('button', {
    name: 'Remove Boneless Skinless Chicken Breast filter',
  })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove High Protein filter' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove saved recipes only filter' })).toBeVisible();
  await expect.poll(() => discoveryUrls.length).toBe(3);

  const filteredRequest = discoveryUrls.at(-1)!;
  expect(filteredRequest.searchParams.getAll('ingredientIds')).toEqual(['7']);
  expect(filteredRequest.searchParams.getAll('badges')).toEqual(['High Protein']);
  expect(filteredRequest.searchParams.get('savedOnly')).toBe('true');

  const cardSelection = page.locator('.recipe-card__selection');
  await cardSelection.focus();
  await cardSelection.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Chicken Power Bowl', { exact: true })).toBeVisible();
  await expect(dialog.getByText('35 min', { exact: true })).toBeVisible();
  await expect(dialog.locator('.recipe-quick-preview__skeleton--description')).toBeVisible();

  await expect(dialog.getByText('A complete lightweight chicken preview.')).toBeVisible();
  await expect(dialog.locator('.recipe-quick-preview__ingredient-list li')).toHaveCount(6);
  await expect(dialog.getByText('+ 2 more ingredients')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Start Cooking' })).toBeDisabled();
  await expect(dialog.getByText('View Full Recipe')).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Save Recipe' }).click();
  await expect(dialog.getByRole('button', { name: 'Saved' })).toBeVisible();
  await expect.poll(() => saveRequests).toBe(1);
  await dialog.getByRole('button', { name: 'Close recipe preview' }).click();
  await expect(cardSelection).toBeFocused();

  await page.getByRole('button', { name: 'Remove saved recipe', exact: true }).click();
  await expect.poll(() => removeRequests).toBe(1);
});

test('the explicit Load More path forwards the opaque cursor and appends cards', async ({ page }) => {
  const recipeUrls: URL[] = [];
  await page.addInitScript(() => {
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: undefined,
    });
  });

  await page.route(API_PATTERN, async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/api/auth/session') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ userId: 42, username: 'recipe-tester' }),
      });
      return;
    }

    if (url.pathname === '/api/users/me') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ username: 'recipe-tester', imageUrl: null }),
      });
      return;
    }

    if (url.pathname === '/api/recipes') {
      recipeUrls.push(url);
      const cursor = url.searchParams.get('cursor');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(cursor === null
          ? { items: [card(1)], nextCursor: 'opaque.cursor.value', hasMore: true }
          : { items: [card(2)], nextCursor: null, hasMore: false }),
      });
      return;
    }

    await route.abort('failed');
  });

  await page.goto('/recipes');
  await page.getByRole('button', { name: 'Load more recipes' }).click();

  await expect(page.locator('app-recipe-card')).toHaveCount(2);
  expect(recipeUrls).toHaveLength(2);
  expect(recipeUrls[1]?.searchParams.get('cursor')).toBe('opaque.cursor.value');
  await expect(page).not.toHaveURL(/cursor=/);
});

test('Quick Preview uses the same full-screen experience on a narrow mobile viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(API_PATTERN, async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/api/auth/session') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ userId: 42, username: 'recipe-tester' }),
      });
      return;
    }
    if (url.pathname === '/api/users/me') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ username: 'recipe-tester', imageUrl: null }),
      });
      return;
    }
    if (url.pathname === '/api/recipes/12/preview') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(preview()),
      });
      return;
    }
    if (url.pathname === '/api/recipes') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [card(12)], nextCursor: null, hasMore: false }),
      });
      return;
    }
    await route.abort('failed');
  });

  await page.goto('/recipes');
  await page.locator('.recipe-card__selection').click();

  const dialog = page.getByRole('dialog');
  const surface = dialog.locator('.mat-mdc-dialog-surface');
  await expect(dialog.getByText('A complete lightweight chicken preview.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close recipe preview' })).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Start Cooking' })).toBeDisabled();
  await expect(surface).toHaveCSS('border-radius', '0px');
  const box = await surface.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(389);
  expect(box?.height).toBeGreaterThanOrEqual(843);
});

function card(id: number) {
  return {
    id,
    name: id === 12 ? 'Chicken Power Bowl' : `Recipe ${id}`,
    cardImageUrl: null,
    totalTimeMinutes: 35,
    caloriesPerServing: 420,
    estimatedCostPerServing: 2.5,
    badges: ['High Protein'],
    featuredIngredients: [
      { id: 7, name: 'Chicken Breast', featuredOrder: 1 },
      { id: 8, name: 'Jasmine Rice', featuredOrder: 2 },
    ],
    isSaved: false,
  };
}

function preview() {
  return {
    id: 12,
    name: 'Chicken Power Bowl',
    description: 'A complete lightweight chicken preview.',
    previewImageUrl: null,
    totalTimeMinutes: 35,
    caloriesPerServing: 420,
    proteinPerServing: 38.5,
    estimatedCostPerServing: 2.5,
    badges: ['High Protein'],
    ingredients: Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      name: `Ingredient ${index + 1}`,
    })),
    isSaved: false,
  };
}

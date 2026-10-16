import { expect, test, Page } from '@playwright/test';
test.use({ ignoreHTTPSErrors: true });
const API = '**/api/**';
const ingredient = { id: 7, name: 'Carrot', basis: 100, basisUnit: 'g', price: 2, caloriesKcal: 100, imageUrl: null, proteinG: 10, fatG: null, carbsG: 20, sugarG: null, fiberG: null, sodiumMg: null, vitaminCMg: null, ironMg: null };
function detail(name = 'Soup') { return { id: 42, name, description: 'Saved soup', previewImageUrl: null, prepTimeMinutes: 15, cookTimeMinutes: 20, totalTimeMinutes: 35, servings: 2, difficulty: 'Easy', badges: [], diets: [], caloriesTotal: 200, proteinTotal: 20, carbsTotal: 40, caloriesPerServing: 100, proteinPerServing: 10, estimatedCostPerServing: 2, instructions: [{ title: 'Prepare', instruction: 'Cook' }], ingredients: [{ ingredientId: 7, quantity: 200, unit: 'g', featuredOrder: 1, ingredient }] }; }
async function fixture(page: Page, permissions: string[]) {
    const state = { permissions, denial: 0, version: '1', writes: 0, reads: 0, headers: [] as string[], sessionReads: 0, invalidSession: false };
    await page.route(API, async (route) => {
        const request = route.request(), path = new URL(request.url()).pathname;
        const json = (body: unknown, status = 200, headers?: Record<string, string>) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'Access-Control-Expose-Headers': 'ETag', ...headers } });
        if (path === '/api/auth/csrf')
            return json({ requestToken: 'test-only-csrf', headerName: 'X-CSRF-TOKEN' });
        if (path === '/api/auth/session') {
            state.sessionReads++;
            if (state.invalidSession)
                return json({ code: 'session_expired' }, 401);
            return json({ userId: 1, username: 'e002-tester', permissions: state.permissions });
        }
        if (path === '/api/users/me')
            return json({ username: 'e002-tester', imageUrl: null });
        if (path === '/api/diets' || path === '/api/ingredients')
            return json([]);
        if (path === '/api/recipes/search')
            return json({ items: [], totalCount: 0, page: 1, pageSize: 12, hasNextPage: false });
        if (path.startsWith('/api/admin/recipe-details/')) {
            if (request.method() === 'GET') {
                state.reads++;
                if (state.denial)
                    return json({}, state.denial);
                return json({ resource: detail(state.version === '1' ? 'Soup' : 'Saved newer soup'), resourceVersion: state.version, createdByUserId: null, updatedByUserId: 1 }, 200, { ETag: '"catalog-recipe-42-v' + state.version + '"' });
            }
            if (request.method() === 'PUT') {
                state.writes++;
                state.headers.push(request.headers()['if-match']!);
                expect(request.headers()['x-csrf-token']).toBe('test-only-csrf');
                if (state.denial)
                    return json({}, state.denial);
                state.version = '2';
                return json({ code: 'catalog_precondition_failed' }, 412);
            }
        }
        return json({}, 404);
    });
    return state;
}
test('ordinary account has no administrative navigation and direct entry performs no admin read', async ({ page }) => {
    const state = await fixture(page, []);
    await page.goto('/admin-recipes/create');
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('link', { name: 'Create Recipes', exact: true })).toHaveCount(0);
    expect(state.reads).toBe(0);
    expect(state.writes).toBe(0);
});
test('read-only moderator cannot create or edit through existing authoring routes', async ({ page }) => {
    const state = await fixture(page, ['Catalog.ReadAdmin']);
    await page.goto('/admin-recipes/42/edit');
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('link', { name: 'Create Recipes', exact: true })).toHaveCount(0);
    expect(state.reads).toBe(0);
});
test('write-only account may create but cannot substitute a public detail read for editing', async ({ page }) => {
    const state = await fixture(page, ['Catalog.Write']);
    await page.goto('/admin-recipes/create');
    await expect(page.getByRole('heading', { name: 'Create New Recipe' })).toBeVisible();
    await page.goto('/admin-recipes/42/edit');
    await expect(page).toHaveURL(/\/home$/);
    expect(state.reads).toBe(0);
    expect(state.writes).toBe(0);
});
test('stale edit preserves draft, exact ETag, and explicit review without mutation replay', async ({ page }) => {
    const state = await fixture(page, ['Catalog.ReadAdmin', 'Catalog.Write']);
    await page.goto('/admin-recipes/42/edit');
    await expect(page.getByLabel('Recipe Name', { exact: true })).toHaveValue('Soup');
    await page.getByLabel('Recipe Name', { exact: true }).fill('My unsaved recipe');
    await page.getByRole('button', { name: 'Update Recipe', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByLabel('Recipe Name', { exact: true })).toHaveValue('My unsaved recipe');
    expect(state.writes).toBe(1);
    expect(state.headers).toEqual(['"catalog-recipe-42-v1"']);
    await page.getByRole('button', { name: 'Refresh saved recipe', exact: true }).click();
    await expect(page.getByText('Saved version 2:', { exact: false })).toBeVisible();
    await expect(page.getByLabel('Recipe Name', { exact: true })).toHaveValue('My unsaved recipe');
    await page.getByRole('button', { name: 'I reviewed the saved version and my draft' }).click();
    expect(state.writes).toBe(1);
    await page.getByRole('button', { name: 'Update Recipe', exact: true }).click();
    await expect.poll(() => state.writes).toBe(2);
    expect(state.headers).toEqual(['"catalog-recipe-42-v1"', '"catalog-recipe-42-v2"']);
});
test('permission removal on focus clears an open administrative draft and navigation', async ({ page }) => {
    const state = await fixture(page, ['Catalog.ReadAdmin', 'Catalog.Write']);
    await page.goto('/admin-recipes/42/edit');
    await expect(page.getByLabel('Recipe Name', { exact: true })).toHaveValue('Soup');
    await page.getByLabel('Recipe Name', { exact: true }).fill('Private old draft');
    state.permissions = [];
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('link', { name: 'Create Recipes', exact: true })).toHaveCount(0);
    await expect(page.getByText('Private old draft')).toHaveCount(0);
    expect(state.writes).toBe(0);
});
test('authoritative 403 clears administrative content and revalidates rather than retrying', async ({ page }) => {
    const state = await fixture(page, ['Catalog.ReadAdmin', 'Catalog.Write']);
    await page.goto('/admin-recipes/42/edit');
    await expect(page.getByLabel('Recipe Name', { exact: true })).toHaveValue('Soup');
    state.permissions = [];
    state.denial = 403;
    await page.getByRole('button', { name: 'Update Recipe', exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
    expect(state.writes).toBe(1);
    await expect(page.getByLabel('Recipe Name', { exact: true })).toHaveCount(0);
    expect(state.sessionReads).toBeGreaterThan(2);
});
test('stale-session 401 uses the existing sign-in flow and clears the open draft', async ({ page }) => {
    const state = await fixture(page, ['Catalog.ReadAdmin', 'Catalog.Write']);
    await page.goto('/admin-recipes/42/edit');
    await expect(page.getByLabel('Recipe Name', { exact: true })).toHaveValue('Soup');
    state.invalidSession = true;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByLabel('Recipe Name', { exact: true })).toHaveCount(0);
    expect(state.writes).toBe(0);
});
test('live local Swagger and credentialed anonymous session match the E002 handoff (no mocks)', async ({ page, request }) => {
    const schemaResponse = await request.get('https://localhost:5001/swagger/v1/swagger.json');
    expect(schemaResponse.status()).toBe(200);
    const schema = await schemaResponse.json();
    expect(schema.components.schemas.UserSessionDto.required).toContain('permissions');
    expect(schema.components.schemas.UserSessionDto.properties.permissions).toMatchObject({ type: 'array', items: { type: 'string' } });
    await page.goto('https://localhost:4200/auth/login');
    const session = await page.evaluate(async () => { const response = await fetch('https://localhost:5001/api/auth/session', { credentials: 'include' }); return { status: response.status, cacheControl: response.headers.get('Cache-Control') }; });
    expect(session.status).toBe(401);
    expect(session.cacheControl).toContain('no-store');
});

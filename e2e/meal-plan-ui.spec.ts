import { expect, test, Page } from '@playwright/test';

const targets = { caloriesKcal: 3050, proteinG: 105, carbsG: 455, fatG: 90 };
const profile = { calculationSex: 'male', birthYear: 1998, heightCm: 178, weightKg: 72 };
const inputs = { ...profile, ageYears: 28, goal: 'performance', activityLevel: 'active' };
const names = ['Regular Training', 'Cutting', 'Simple Week', 'High Protein', 'Maintenance', 'Performance'];
const goals = ['performance', 'fatLoss', null, 'muscleGain', 'maintain', 'recomposition'];
const plans = names.map((name, index) => ({
  id: index + 1, name, mode: index === 2 ? 'easy' : 'intermediate',
  defaultMealsPerDay: 4, goal: goals[index], activityLevel: index === 2 ? null : 'active',
  targets: index === 2 ? null : targets, calculationPolicyVersion: index === 2 ? null : '2026.1',
  calculatedAt: '2026-10-13T12:00:00Z', createdAt: '2026-10-13T12:00:00Z', updatedAt: '2026-10-13T12:00:00Z',
}));
const settings = { currentNutritionPlanId: 1, currentPlan: { id: 1, name: names[0], mode: 'intermediate', defaultMealsPerDay: 4, targets, calculationPolicyVersion: '2026.1' } };
async function mockApi(page: Page, permissions: string[] = []) {
  const state = { previews: 0, writes: 0 };
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/auth/csrf') return json({ requestToken: 'ui-test-only', headerName: 'X-CSRF-TOKEN' });
    if (path === '/api/auth/session') return json({ userId: 1, username: 'mathieu', permissions });
    if (path === '/api/users/me') return json({ username: 'mathieu', imageUrl: null });
    if (path === '/api/users/me/nutrition-profile') return json({ revision: '8', profile });
    if (path === '/api/nutrition-plans/calculation-preview') {
      state.previews++;
      const calculation = request.postDataJSON();
      return json({ policyVersion: '2026.1', calculationYear: 2026, inputs: { ...calculation.profile, ageYears: 28, goal: calculation.goal, activityLevel: calculation.activityLevel }, rmrKcal: 1600, maintenanceKcal: 2600, targets, warnings: [] });
    }
    if (path === '/api/nutrition-plans/1' && request.method() === 'GET') return json({ revision: '8', settings, profileDiffers: false, plan: { ...plans[0], calculationInputs: inputs, rmrKcal: 1600, maintenanceKcal: 2600, warnings: [] } });
    if (path === '/api/nutrition-plans' && request.method() === 'GET') return json({ revision: '8', settings, plans });
    if (request.method() !== 'GET') state.writes++;
    return json({ code: 'test_unhandled_request' }, 404);
  });
  return state;
}
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.locator('.meal-plan-shell h1').evaluate(el => (el as HTMLElement).focus({ preventScroll: true }));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('.hdr__brand')).toBeInViewport();
  await page.screenshot({ path: 'test-results/meal-plan-ui/' + name + '.png', fullPage: true, animations: 'disabled' });
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const main = page.locator('.meal-plan-shell');
  expect(await main.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
}

test('Meal Plan uses the shared orange theme and profile errors are plain text', async ({ page }) => {
  await mockApi(page);
  await page.goto('/meal-plan/nutrition-plans');
  const button = page.getByRole('button', { name: 'Create Nutrition Plan', exact: false });
  const theme = await button.evaluate(element => {
    const root = getComputedStyle(document.documentElement);
    const local = getComputedStyle(element);
    const probe = document.createElement('span');
    probe.style.color = 'var(--color-primary)';
    document.body.append(probe);
    const primary = getComputedStyle(probe).color;
    probe.remove();
    return { primary, background: local.backgroundColor,
      rootHue: root.getPropertyValue('--color-primary-hsl').trim(),
      localHue: local.getPropertyValue('--color-primary-hsl').trim() };
  });
  expect(theme.localHue).toBe(theme.rootHue);
  expect(theme.background).toBe(theme.primary);
  await expect(page.locator('.meal-plan-header > .text-eyebrow')).toHaveCSS('color', theme.primary);
  await button.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => getComputedStyle(element).getPropertyValue('--color-primary-hsl').trim()))
    .toBe(theme.rootHue);
  await page.keyboard.press('Escape');
  await page.goto('/meal-plan/nutrition-plans/create/intermediate/profile');
  await page.locator('#nutrition-height').fill('119');
  await page.locator('#nutrition-weight').focus();
  const summary = page.locator('.nutrition-profile__summary');
  await expect(summary).toContainText('Enter 120–230 cm with up to two decimals.');
  await expect(summary.locator('a')).toHaveCount(0);
  await expect(page.locator('#nutrition-height')).toHaveAttribute('aria-invalid', 'true');
});

test('desktop dashboard matches reference card hierarchy with supported actions and white background', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const state = await mockApi(page);
  await page.goto('/meal-plan/nutrition-plans');
  await expect(page.getByRole('heading', { name: 'Nutrition Plans', exact: true })).toBeVisible();
  await expect(page.locator('#plans-title')).toHaveClass('page-title-sr');
  await expect(page.getByRole('button', { name: 'Create Nutrition Plan', exact: false })).toHaveCount(1);
  await expect(page.locator('.plan-card')).toHaveCount(6);
  await expect(page.locator('.hdr__nav a[href="/meal-plan"]')).toBeVisible();
  const cards = await page.locator('.plan-card').evaluateAll(els => els.slice(0, 3).map(el => el.getBoundingClientRect().top));
  expect(new Set(cards)).toHaveProperty('size', 1);
  expect(await page.locator('app-meal-plan-shell').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  await noOverflow(page); await capture(page, '04-nutrition-plans-desktop');
  expect(state.writes).toBe(0);
});

for (const mobile of [false, true]) {
  test((mobile ? 'mobile' : 'desktop') + ' wizard keeps coherent steps, native keyboard choices and server review', async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 });
    const state = await mockApi(page);
    await page.goto('/meal-plan/nutrition-plans/create/intermediate/profile');
    await expect(page.locator('#nutrition-age')).toHaveValue('28');
    await expect(page.locator('.step-strip [aria-current="step"]')).toContainText('Profile');
    await noOverflow(page); await capture(page, '05-profile-' + (mobile ? 'mobile' : 'desktop'));
    await page.getByRole('button', { name: 'Continue', exact: false }).click();
    await expect(page.locator('app-goal-step input[type=radio]')).toHaveCount(6);
    await page.locator('#goal-performance').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#goal-performance')).toBeChecked();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#goal-maintain')).toBeChecked();
    await noOverflow(page); await capture(page, '06-goal-' + (mobile ? 'mobile' : 'desktop'));
    await page.getByRole('button', { name: 'Continue', exact: false }).click();
    await page.locator('#activity-active').check();
    await expect(page.locator('app-activity-step .choice-card.is-selected')).toContainText('Active');
    await noOverflow(page); await capture(page, '07-activity-' + (mobile ? 'mobile' : 'desktop'));
    await page.getByRole('button', { name: 'Continue', exact: false }).click();
    await expect(page.locator('.meal-choice')).toHaveCount(8);
    await page.locator('#meal-count-4').check();
    await noOverflow(page); await capture(page, '08-meal-structure-' + (mobile ? 'mobile' : 'desktop'));
    await page.getByRole('button', { name: 'Continue', exact: false }).click();
    await page.getByLabel('Plan name', { exact: true }).fill('Regular Training');
    await expect(page.locator('app-review-step')).toContainText('3,050 kcal');
    await expect(page.getByRole('button', { name: 'Create Nutrition Plan', exact: false })).toBeEnabled();
    await expect(page.locator('.review-row')).toHaveCount(4);
    await noOverflow(page); await capture(page, '09-review-' + (mobile ? 'mobile' : 'desktop'));
    expect(state.previews).toBeGreaterThan(0);
    expect(state.writes).toBe(0);
    await page.getByRole('button', { name: 'Change goal', exact: true }).click();
    await expect(page.locator('#goal-maintain')).toBeChecked();
  });
}

for (const mobile of [false, true]) {
  test((mobile ? 'mobile' : 'desktop') + ' edit has section selectors and target sidebar without automatic recalculation', async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 });
    const state = await mockApi(page);
    await page.goto('/meal-plan/nutrition-plans/1/edit');
    await expect(page.getByRole('heading', { name: 'Edit Nutrition Plan' })).toBeVisible();
    await expect(page.locator('.target-sidebar')).toContainText('Saved estimates');
    await expect(page.locator('#goal-performance')).toHaveValue('performance');
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeVisible();
    await noOverflow(page); await capture(page, '10-edit-' + (mobile ? 'mobile' : 'desktop'));
    await page.locator('#goal-performance').selectOption('maintain');
    expect(state.previews).toBe(0);
    expect(state.writes).toBe(0);
    await page.getByRole('button', { name: 'Recalculate estimates' }).click();
    await expect(page.getByText('Preview estimates — not saved yet')).toBeVisible();
    await expect.poll(() => state.previews).toBe(1);
    expect(state.writes).toBe(0);
  });
}

test('mobile header opens Meal Plan navigation and dashboard cards stack', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mockApi(page);
  await page.goto('/meal-plan/nutrition-plans');
  await expect(page.locator('.plan-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Meal Plan', exact: true }).click();
  await expect(page).toHaveURL(/meal-plan\/planner(?:\?|$)/);
  await page.goto('/meal-plan/nutrition-plans');
  await noOverflow(page); await capture(page, '04-nutrition-plans-mobile');
});

test('narrow mobile, tablet and admin desktop reflow preserve labels, controls and reachable actions', async ({ page }) => {
  await mockApi(page, ['Catalog.ReadAdmin', 'Catalog.Write']);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/meal-plan/nutrition-plans');
    await expect(page.locator('.plan-card')).toHaveCount(6);
    await noOverflow(page);
    await page.goto('/meal-plan/nutrition-plans/create/intermediate/profile');
    await expect(page.locator('#nutrition-age')).toHaveValue('28');
    await noOverflow(page);
    await page.getByRole('button', { name: 'Continue', exact: false }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Continue', exact: false })).toBeInViewport();
    await page.getByRole('button', { name: 'Continue', exact: false }).click();
    await expect(page.locator('app-goal-step input[type=radio]')).toHaveCount(6);
    await noOverflow(page);
    await page.goto('/meal-plan/nutrition-plans/1/edit');
    await expect(page.locator('#edit-name')).toHaveValue('Regular Training');
    await noOverflow(page);
    await page.getByRole('button', { name: 'Save changes', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeInViewport();
  }
});

for (const mobile of [false, true]) {
  test((mobile ? 'mobile' : 'desktop') + ' shares one header across tabs and opens an accessible mode chooser without writes', async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 });
    const state = await mockApi(page);
    await page.goto('/meal-plan/nutrition-plans');
    await expect(page.locator('.plan-card')).toHaveCount(6);
    const header = page.locator('.meal-plan-header');
    const original = await header.boundingBox();
    const top = await header.innerText();
    await page.getByRole('navigation', { name: 'Meal Plan sections' }).getByRole('link', { name: 'Meal Planner', exact: true }).click();
    await expect(page).toHaveURL(/meal-plan\/planner(?:\?|$)/);
    await expect(page.locator('#planner-title')).toHaveClass('page-title-sr');
    expect(await header.innerText()).toBe(top);
    expect(await header.boundingBox()).toEqual(original);
    await expect(page.getByRole('button', { name: 'Create Nutrition Plan', exact: false })).toHaveCount(1);
    await capture(page, 'planner-shared-header-' + (mobile ? 'mobile' : 'desktop'));
    const create = page.locator('#meal-plan-create');
    await create.click();
    const dialog = page.getByRole('dialog', { name: 'What would you like Appetee to help with?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Easy/ })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Intermediate/ })).toBeVisible();
    await page.screenshot({ path: 'test-results/meal-plan-ui/create-choice-' + (mobile ? 'mobile' : 'desktop') + '.png', fullPage: true, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(create).toBeFocused();
    expect(state.writes).toBe(0);
    await create.click();
    // Wait for the dialog's initial focus/animation before testing its Tab order.
    // Forcing focus early races Material's deferred autofocus and can steal Tab focus back.
    await expect(page.getByRole('button', { name: 'Close plan type selection' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /^Easy/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/nutrition-plans\/create\/easy$/);
    await expect(page.locator('.meal-plan-header')).toHaveCount(0);
    expect(state.writes).toBe(0);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page).toHaveURL(/nutrition-plans$/);
    await expect(create).toBeFocused();
    await create.click();
    await page.getByRole('button', { name: /^Intermediate/ }).click();
    await expect(page).toHaveURL(/create\/intermediate\/profile$/);
    await expect(page.locator('.meal-plan-header')).toHaveCount(0);
    expect(state.writes).toBe(0);
  });
}

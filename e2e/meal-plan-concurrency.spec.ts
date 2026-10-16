import { test, expect } from '@playwright/test';
import { fixture } from './fixtures/meal-plan.fixture';
import { fillManual } from './fixtures/manual-form.fixture';

test('two tabs starting at one version conflict without automatic mutation replay', async ({ page, context }) => {
  const state = await fixture(page), other = await context.newPage(); await fixture(other, state);
  const url = '/meal-plan/planner?date=2026-10-12&task=meal&mealId=20'; await page.goto(url); await other.goto(url);
  await expect(page.getByLabel('Meal name', { exact: true })).toHaveValue('Lunch'); await expect(other.getByLabel('Meal name', { exact: true })).toHaveValue('Lunch');
  // Dispatching through the rendered controls keeps both already-loaded tab contexts intact.
  await page.getByLabel('Meal name', { exact: true }).evaluate((input: HTMLInputElement) => { input.value = 'First tab'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('blur')); });
  await expect.poll(() => state.revision).toBe(9);
  await other.getByLabel('Meal name', { exact: true }).evaluate((input: HTMLInputElement) => { input.value = 'Second tab draft'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('blur')); });
  await expect(other.getByRole('alert')).toContainText('Refresh and review');
  expect(state.writes).toHaveLength(2); expect(state.writes[1]?.revision).toBe('8'); expect(state.saved.get('2026-10-12').meals[0].name).toBe('First tab');
  await other.getByRole('button', { name: 'Refresh saved day', exact: true }).click(); await expect(other.getByLabel('Meal name', { exact: true })).toHaveValue('Second tab draft');
  expect(state.writes).toHaveLength(2); await other.close();
});

test('manual CSRF rejection and uncertain transport outcomes preserve drafts and never replay', async ({ page }) => {
  const state = await fixture(page); await page.goto('/meal-plan/planner?date=2026-10-12&task=manual&mealId=20'); await fillManual(page);
  state.error = 400; await page.getByRole('button', { name: 'Add manual food', exact: true }).click();
  await expect(page.locator('app-manual-item-editor [role=alert]')).toContainText('rejected before saving'); expect(state.writes).toHaveLength(1);
  state.error = 0; await page.getByRole('button', { name: 'Refresh saved day', exact: true }).click();
  await page.getByRole('button', { name: 'I reviewed the saved day and my draft', exact: true }).click(); expect(state.writes).toHaveLength(1);
  state.error = 503; await page.getByRole('button', { name: 'Add manual food', exact: true }).click();
  await expect(page.locator('app-manual-item-editor [role=alert]')).toContainText('Outcome unknown');
  await expect(page.getByLabel('Food name', { exact: true })).toHaveValue('Trail snack'); expect(state.writes).toHaveLength(2); expect(state.saved.get('2026-10-12').meals[0].items).toHaveLength(1);
});

test('a changed copy destination invalidates old review; failed confirmation requires fresh inspection', async ({ page }) => {
  const state = await fixture(page); await page.goto('/meal-plan/planner?date=2026-10-12&task=day'); await page.getByRole('button', { name: 'Copy day', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Copy day', exact: true }); await dialog.getByLabel('Destination', { exact: true }).fill('2026-10-19');
  let bumped = false; state.readHook = from => { if (from === '2026-10-19' && !bumped) { state.revision = 9; bumped = true; } };
  await dialog.getByRole('button', { name: 'Review destination', exact: true }).click(); await expect(dialog.locator('ol.mappings > li')).toHaveCount(1);
  expect(state.writes).toHaveLength(0); state.error = 409; await dialog.getByRole('button', { name: 'Copy day', exact: true }).click();
  await expect(dialog).toContainText('Review fresh source and destination'); expect(state.writes[0]?.revision).toBe('9'); expect(state.saved.has('2026-10-19')).toBe(false);
  state.error = 0; await expect(dialog.getByRole('button', { name: 'Copy day', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Review destination', exact: true }).click(); await expect(dialog.locator('ol.mappings > li')).toHaveCount(1); expect(state.writes).toHaveLength(1);
  await dialog.getByLabel('Destination', { exact: true }).fill('2026-10-20'); await expect(dialog.getByRole('button', { name: 'Copy day', exact: true })).toBeDisabled(); expect(state.writes).toHaveLength(1);
});

test('session expiry clears the manual draft through the central authentication flow', async ({ page }) => {
  const state = await fixture(page); await page.goto('/meal-plan/planner?date=2026-10-12&task=manual&mealId=20'); await fillManual(page);
  state.authenticated = false; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page).toHaveURL(/login/); await expect(page.getByLabel('Food name', { exact: true })).toHaveCount(0); expect(state.writes).toHaveLength(0);
});

test('closing an unknown-outcome copy retains visible reconciliation and disables subsequent writes', async ({ page }) => {
  const state = await fixture(page); await page.goto('/meal-plan/planner?date=2026-10-12&task=day');
  await page.getByRole('button', { name: 'Copy day', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Copy day', exact: true });
  await dialog.getByLabel('Destination', { exact: true }).fill('2026-10-19'); await dialog.getByRole('button', { name: 'Review destination', exact: true }).click();
  await expect(dialog.locator('ol.mappings > li')).toHaveCount(1); state.error = 503;
  await dialog.getByRole('button', { name: 'Copy day', exact: true }).click(); await expect(dialog).toContainText('Copy outcome unknown');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Outcome unknown');
  await expect(page.getByRole('button', { name: 'New Meal', exact: false })).toBeDisabled(); expect(state.writes).toHaveLength(1);
  state.error = 0; await page.getByRole('button', { name: 'Refresh saved day', exact: true }).click();
  await page.getByRole('button', { name: 'I reviewed the saved day and my draft', exact: true }).click(); expect(state.writes).toHaveLength(1);
});

test('navigation waits for a sent manual Add without its success returning over the chosen section', async ({ page }) => {
  const state = await fixture(page); state.holdManual = true;
  await page.goto('/meal-plan/planner?date=2026-10-12&task=manual&mealId=20'); await fillManual(page);
  await page.getByRole('button', { name: 'Add manual food', exact: true }).click(); await expect.poll(() => state.writes.length).toBe(1);
  await page.getByRole('navigation', { name: 'Meal Plan sections' }).getByRole('link', { name: 'Nutrition Plans', exact: true }).evaluate((link: HTMLAnchorElement) => link.click());
  await expect(page).toHaveURL(/task=manual/); state.release!();
  await expect(page).toHaveURL(/nutrition-plans$/); expect(state.writes).toHaveLength(1); expect(state.saved.get('2026-10-12').meals[0].items).toHaveLength(2);
});

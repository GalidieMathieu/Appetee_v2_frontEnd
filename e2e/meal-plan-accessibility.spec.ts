import { test, expect } from '@playwright/test';
import { fixture } from './fixtures/meal-plan.fixture';

test('manual keyboard errors, linked fields and task Back remain usable at narrow widths', async ({ page }) => {
  const state = await fixture(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  state.saved.get('2026-10-12').meals[0].name = 'W'.repeat(80);
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 }); await page.goto('/meal-plan/planner?date=2026-10-12&task=manual&mealId=20');
    const submit = page.getByRole('button', { name: 'Add manual food', exact: true }); await submit.focus(); await page.keyboard.press('Enter');
    const summary = page.locator('app-manual-item-editor [role=alert]'); await expect(summary).toBeFocused(); await expect(summary.locator('a')).toHaveCount(5);
    await summary.getByRole('link').first().click(); await expect(page.getByLabel('Food name', { exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(page).toHaveURL(/task=meal/);
    await page.getByRole('button', { name: 'Copy week', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Copy week', exact: true });
    await dialog.getByLabel('Destination Monday', { exact: true }).fill('2026-10-19');
    await dialog.getByRole('button', { name: 'Review destination week', exact: true }).click();
    await expect(dialog.locator('ol.mappings > li')).toHaveCount(7);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Back to day', exact: false }).click();
    expect(await page.locator('.meal-plan-shell').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
  expect(state.writes).toHaveLength(0);
});

test('planner controls reflow with 200 percent text enlargement and a visible keyboard focus outline', async ({ page }) => {
  await fixture(page); await page.setViewportSize({ width: 1280, height: 960 }); await page.goto('/meal-plan/planner?date=2026-10-12&task=manual&mealId=20');
  await page.locator('html').evaluate(element => element.style.fontSize = '200%');
  const field = page.getByLabel('Food name', { exact: true }); await field.focus(); await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).not.toBe('none');
});

test('primary action contrast meets 4.5 to 1 while preserving scoped Appetee orange styling', async ({ page }) => {
  await fixture(page); await page.goto('/meal-plan/planner?date=2026-10-12&task=manual&mealId=20');
  const contrast = await page.getByRole('button', { name: 'Add manual food', exact: true }).evaluate(element => {
    const style = getComputedStyle(element);
    const luminance = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index]!, 0);
    const a = luminance(style.color), b = luminance(style.backgroundColor); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});

import { expect, test, Page } from '@playwright/test';
import { fixture, item, meal } from './fixtures/meal-plan.fixture';

// Synthetic API data only. Images/times absent from MP01 are intentionally not fabricated.
async function referenceDay(page: Page) {
  const state = await fixture(page);
  const food = (id: number, name: string, caloriesKcal: number, proteinG: number, carbsG: number, fatG: number) => ({
    ...item(id, id + 100, name), warnings: [], perServing: { caloriesKcal, proteinG, carbsG, fatG }, nutrition: { caloriesKcal, proteinG, carbsG, fatG },
  });
  const meals = [
    { ...meal(19, 'Breakfast'), sortOrder: 1, warnings: [], items: [food(28, 'Egg White Breakfast Muffins', 320, 30, 1, 18), food(29, 'Banana', 105, 1, 27, 0)], totals: { caloriesKcal: 425, proteinG: 31, carbsG: 28, fatG: 18 } },
    { ...meal(20, 'Lunch'), sortOrder: 2, warnings: [], items: [food(30, 'Grilled Chicken Rice Bowl', 560, 52, 62, 12), food(31, 'Steamed Broccoli', 31, 3, 6, 0)], totals: { caloriesKcal: 591, proteinG: 55, carbsG: 68, fatG: 12 } },
    { ...meal(21, 'Dinner'), sortOrder: 3, warnings: [], items: [food(32, 'Salmon Quinoa Bowl', 520, 38, 45, 20), food(33, 'Greek Yogurt', 100, 17, 6, 0)], totals: { caloriesKcal: 620, proteinG: 55, carbsG: 51, fatG: 20 } },
  ];
  state.saved.set('2026-09-29', {
    date: '2026-09-29', id: 10, persistence: 'saved', savedMealCount: 3, meals,
    totals: { caloriesKcal: 1636, proteinG: 141, carbsG: 147, fatG: 50 },
    targets: { caloriesKcal: 3050, proteinG: 105, carbsG: 380, fatG: 120 },
    remaining: { caloriesKcal: 1414, proteinG: -36, carbsG: 233, fatG: 70 }, warnings: [],
  });
  return state;
}

for (const width of [1672, 1440, 1280, 1024, 768, 390, 320]) {
  test(`reference planner and editor layout at ${width}px retains real data and actions`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const state = await referenceDay(page);
    await page.goto('/meal-plan/planner?date=2026-09-29&task=day');
    await expect(page.getByRole('button', { name: 'View Lunch', exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.locator('app-week-strip button').evaluateAll(buttons => buttons.every(button => button.scrollWidth <= button.clientWidth + 1))).toBe(true);
    const header = await page.locator('.meal-plan-header').boundingBox();
    const strip = await page.locator('app-week-strip').boundingBox();
    expect(strip!.y).toBeGreaterThan(header!.y + header!.height);
    const cards = page.locator('app-week-strip button');
    expect((await cards.first().boundingBox())!.height).toBeLessThanOrEqual(90);
    await expect(page.locator('app-nutrition-summary details, app-nutrition-summary summary')).toHaveCount(0);
    if (width >= 1024) {
      // Regressions: laptop-width media query used to stack the date/metrics,
      // and vertical padding made the reference's shallow panel nearly square.
      const dayHeader = page.locator('app-selected-day-panel .day-header');
      const date = await dayHeader.locator('.day-identity').boundingBox();
      const metrics = await dayHeader.locator('.metric').evaluateAll(elements => elements.map(element => {
        const { x, y, width, height } = element.getBoundingClientRect(); return { x, y, width, height };
      }));
      expect((await dayHeader.boundingBox())!.height).toBeLessThanOrEqual(108);
      for (const metric of metrics) {
        expect(metric.x).toBeGreaterThan(date!.x + date!.width);
        expect(Math.abs(metric.y + metric.height / 2 - date!.y - date!.height / 2)).toBeLessThan(2);
      }
      // All seven rectangular cards fit the laptop viewport without shrinking text.
      expect(await page.locator('.week-strip').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    }
    if (width >= 1280) {
      const day = await page.locator('.day-pane').boundingBox();
      expect(day!.height).toBeLessThanOrEqual(580);
      expect(day!.width / day!.height).toBeGreaterThan(2);
      for (const row of await page.locator('[data-order-row-meal]').all()) { expect((await row.boundingBox())!.height).toBeLessThanOrEqual(136); }
    }
    if (width >= 1440) {
      const rows = page.locator('app-meal-row');
      const identity = await rows.first().locator('.meal-identity').boundingBox();
      const foods = await rows.first().locator('.foods').boundingBox();
      const nutrition = await rows.first().locator('.meal-nutrients').boundingBox();
      expect(foods!.x).toBeGreaterThan(identity!.x + identity!.width);
      expect(nutrition!.x).toBeGreaterThan(foods!.x + foods!.width);
      expect((await page.locator('.day-pane').boundingBox())!.width).toBeGreaterThan(1200);
    }
    const summary = page.locator('app-selected-day-panel > section > header app-nutrition-summary');
    await expect(summary.locator('.metric-track')).toHaveCount(4);
    await expect(summary).toContainText('Remaining -36 g (over target)');
    await page.screenshot({ path: `test-results/meal-plan-ui/reference-planner-${width}.png`, fullPage: true, animations: 'disabled' });
    expect(await page.locator('.meal-plan-shell').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.getByRole('button', { name: 'View Lunch', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Edit Lunch', exact: true })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Delete meal', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add recipe', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add manual food', exact: true })).toBeVisible();
    if (width > 928) {
      const day = await page.locator('.day-pane').boundingBox(), editor = await page.locator('.task-pane').boundingBox();
      expect(editor!.x).toBeGreaterThan(day!.x + day!.width);
      expect(Math.abs(day!.y - editor!.y)).toBeLessThan(2);
    } else { await expect(page.locator('.day-pane')).toBeHidden(); }
    if (width >= 1440) {
      const name = await page.locator('.editor-item').first().locator('.item-name').boundingBox();
      const quantity = await page.locator('.editor-item').first().locator('.quantity').boundingBox();
      expect(quantity!.x).toBeGreaterThan(name!.x + name!.width);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `test-results/meal-plan-ui/reference-editor-${width}.png`, fullPage: true, animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect(state.writes).toHaveLength(0);
  });
}

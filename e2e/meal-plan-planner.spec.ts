import { expect, test, Page } from '@playwright/test';
import { fixture, item } from './fixtures/meal-plan.fixture';
import { fillManual } from './fixtures/manual-form.fixture';
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: 'test-results/meal-plan-ui/' + name + '.png', fullPage: true, animations: 'disabled' });
  expect(await page.locator('.meal-plan-shell').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
}
for (const mobile of [false, true]) {
  test((mobile ? 'mobile' : 'desktop') + ' meal editor/picker retain day context, confirm addition, quantity and remove', async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 });
    const state = await fixture(page);
    await page.goto('/meal-plan/planner?date=2026-10-12&task=meal&mealId=20');
    await expect(page.getByLabel('Meal name', { exact: true })).toHaveValue('Lunch');
    await capture(page, 'f09-editor-' + (mobile ? 'mobile' : 'desktop'));
    await page.getByRole('button', { name: 'Add recipe', exact: true }).click();
    await expect(page).toHaveURL(/task=recipe-picker/);
    if (mobile) {
      const heading = await page.getByRole('heading', { name: 'Add recipe to Lunch', exact: true }).boundingBox();
      const header = await page.locator('.hdr').boundingBox();
      expect(heading!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
    }
    await expect(page.getByRole('button', { name: 'Chicken Rice Bowl is in this meal' })).toBeDisabled();
    expect(state.writes).toHaveLength(0);
    await capture(page, 'f10-picker-' + (mobile ? 'mobile' : 'desktop'));
    await page.getByRole('button', { name: 'Saved', exact: true }).click();
    await expect(page.locator('app-recipe-picker-row')).toHaveCount(1);
    expect(state.pickerReads.at(-1)).toContain('savedOnly=true');
    await page.getByRole('button', { name: 'Add Salmon Quinoa Bowl', exact: true }).click();
    await expect(page).toHaveURL(/task=meal/);
    await expect(page.locator('app-meal-editor')).toContainText('Salmon Quinoa Bowl');
    expect(state.writes).toHaveLength(1); expect(state.writes[0]?.body).toEqual({ meal: { mealId: 20 }, recipeId: 43, quantity: 1 });
    await page.getByRole('button', { name: 'Increase servings of Chicken Rice Bowl' }).click();
    await expect(page.getByLabel('Servings of Chicken Rice Bowl', { exact: true })).toHaveValue('2');
    await expect.poll(() => state.writes.length).toBe(2);
    await page.getByRole('button', { name: 'Remove Salmon Quinoa Bowl', exact: true }).click();
    await expect(page.locator('app-meal-editor')).not.toContainText('Salmon Quinoa Bowl');
    expect(state.writes).toHaveLength(3);
  });
}
test('session suggestions survive the first save and support a second meal without backend defaultSlot changes', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/meal-plan/planner?date=2026-10-16&task=day');
  await expect(page.locator('app-meal-row')).toHaveCount(3);
  await page.getByRole('button', { name: 'View Breakfast', exact: true }).click();
  await page.getByRole('button', { name: 'Add recipe', exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Add Salmon Quinoa Bowl', exact: true }).click();
  await expect(page).toHaveURL(/task=meal.*mealId=77/);
  await page.getByRole('button', { name: 'Back to day', exact: false }).click();
  await expect(page.locator('app-meal-row')).toHaveCount(3);
  expect(state.saved.get('2026-10-16').meals).toHaveLength(1);
  await page.getByRole('button', { name: 'View Lunch', exact: true }).click();
  await page.getByRole('button', { name: 'Add recipe', exact: true }).click();
  await page.getByRole('button', { name: 'Back to meal', exact: false }).click();
  expect(state.writes).toHaveLength(1);
  await page.getByRole('button', { name: 'Add recipe', exact: true }).click();
  await page.getByRole('button', { name: 'Add Chicken Rice Bowl', exact: true }).click();
  await expect(page).toHaveURL(/task=meal.*mealId=78/);
  expect(state.writes).toHaveLength(3);
  expect(state.writes[1]?.body).toEqual({ name: 'Lunch' });
  expect(state.writes[1]?.revision).toBe('9');
  expect(state.writes[2]?.body).toEqual({ meal: { mealId: 78 }, recipeId: 42, quantity: 1 });
  expect(state.writes[2]?.revision).toBe('10');
  await page.getByRole('button', { name: 'Back to day', exact: false }).click();
  await expect(page.locator('app-meal-row')).toHaveCount(3);
  expect(state.saved.get('2026-10-16').meals).toHaveLength(2);
  await page.getByRole('navigation', { name: 'Meal Plan sections' }).getByRole('link', { name: 'Nutrition Plans', exact: true }).click();
  await page.getByRole('navigation', { name: 'Meal Plan sections' }).getByRole('link', { name: 'Meal Planner', exact: true }).click();
  await page.getByLabel('Jump to date', { exact: true }).fill('2026-10-16');
  await expect(page.locator('app-meal-row')).toHaveCount(3);
  await page.getByRole('button', { name: /Logout/ }).first().click();
  await expect.poll(() => state.authenticated).toBe(false);
  await expect(page).toHaveURL(/login/);
  state.authenticated = true;
  await page.goto('/meal-plan/planner?date=2026-10-16&task=day');
  await expect(page.locator('app-meal-row')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'View Dinner', exact: true })).toHaveCount(0);
});

test('virtual picker open/back is GET-only; adding replaces slot with confirmed identity and no siblings', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/meal-plan/planner?date=2026-10-13&task=recipe-picker&defaultSlot=2');
  await expect(page.getByRole('heading', { name: 'Add recipe to Lunch', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to meal', exact: false }).click();
  await expect(page).toHaveURL(/task=meal/); expect(state.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Add recipe', exact: true }).click();
  await page.getByRole('button', { name: 'Add Salmon Quinoa Bowl', exact: true }).click();
  await expect(page).toHaveURL(/task=meal.*mealId=77/);
  expect(new URL(page.url()).searchParams.has('defaultSlot')).toBe(false);
  expect(state.saved.get('2026-10-13').meals).toHaveLength(1);
  expect(state.writes[0]?.body.meal).toEqual({ defaultSlot: 2 });
});
test('pending rename preserves newer input and navigation discard never sends it', async ({ page }) => {
  const state = await fixture(page); state.holdRename = true;
  await page.goto('/meal-plan/planner?date=2026-10-12&task=meal&mealId=20');
  const input = page.getByLabel('Meal name', { exact: true });
  await input.fill('Sent name'); await input.press('Enter');
  await expect.poll(() => state.writes.length).toBe(1);
  await input.fill('Discard this');
  await page.getByRole('navigation', { name: 'Meal Plan sections' }).getByRole('link', { name: 'Nutrition Plans', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Leave this meal?' })).toBeVisible();
  await page.getByRole('button', { name: 'Discard unsent changes' }).click();
  state.release!();
  await expect(page).toHaveURL(/nutrition-plans$/);
  expect(state.writes).toHaveLength(1);
});
test('conflict rejection never replays and invalid selector falls back without writes', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/meal-plan/planner?date=2026-10-12&task=recipe-picker&mealId=999');
  await expect(page).toHaveURL(/task=day/); expect(state.writes).toHaveLength(0);
  await page.goto('/meal-plan/planner?date=2026-10-12&task=meal&mealId=20');
  state.error = 409;
  const input = page.getByLabel('Meal name', { exact: true }); await input.fill('My conflict draft'); await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Refresh and review');
  expect(state.writes).toHaveLength(1);
  await page.getByRole('button', { name: 'Refresh saved day' }).click();
  await expect(page.getByRole('button', { name: 'I reviewed the saved day and my draft' })).toBeVisible();
  await expect(input).toHaveValue('My conflict draft'); expect(state.writes).toHaveLength(1);
});

test('editor and picker reflow without page overflow across supported widths and a full meal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const state = await fixture(page);
  const full = state.saved.get('2026-10-12');
  full.meals[0].items = Array.from({ length: 20 }, (_, index) => item(30 + index, 42 + index, 'Meal recipe ' + (index + 1)));
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/meal-plan/planner?date=2026-10-12&task=meal&mealId=20');
    await expect(page.getByLabel('Meal name', { exact: true })).toHaveValue('Lunch');
    await expect(page.getByRole('button', { name: 'Add recipe', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.goto('/meal-plan/planner?date=2026-10-12&task=recipe-picker&mealId=20');
    await expect(page.getByRole('heading', { name: 'Add recipe to Lunch', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await expect(page.getByRole('button', { name: 'Chicken Rice Bowl is in this meal' })).toBeDisabled();
  }
  expect(state.writes).toHaveLength(0);
});

test('browser Back guards an invalid unsent name, then discards and restores the meal trigger', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/meal-plan/planner?date=2026-10-12&task=day');
  await page.getByRole('button', { name: 'View Lunch', exact: true }).click();
  await expect(page).toHaveURL(/task=meal/);
  await page.getByLabel('Meal name', { exact: true }).fill('');
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Leave this meal?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save and leave', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Stay', exact: true }).click();
  await expect(page).toHaveURL(/task=meal/);
  await expect(page.getByLabel('Meal name', { exact: true })).toHaveValue('');
  await page.goBack();
  await page.getByRole('button', { name: 'Discard unsent changes', exact: true }).click();
  await expect(page).toHaveURL(/task=day/);
  await expect(page.getByRole('button', { name: 'View Lunch', exact: true })).toBeFocused();
  expect(state.writes).toHaveLength(0);
});
test('deleting the last meal stays saved-empty after reload and New Meal uses only its explicit name', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/meal-plan/planner?date=2026-10-12&task=meal&mealId=20');
  await page.getByRole('button', { name: 'Delete meal', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete meal', exact: true }).click();
  await expect(page).toHaveURL(/task=day/);
  await page.getByRole('button', { name: 'View Dinner', exact: true }).click();
  await page.getByRole('button', { name: 'Delete meal', exact: true }).click();
  await expect(page).toHaveURL(/task=day/);
  await page.reload();
  await expect(page.getByText('This saved day has no meals.', { exact: true })).toBeVisible();
  expect(state.saved.get('2026-10-12').meals).toHaveLength(0);
  await page.getByRole('button', { name: 'New Meal', exact: false }).click();
  await expect(page.getByLabel('Meal name', { exact: true })).toHaveValue('New Meal');
  expect(state.writes.at(-1)?.body).toEqual({ name: 'New Meal' });
});

for (const mobile of [false, true]) {
  test((mobile ? 'mobile' : 'desktop') + ' manual explicit Add/Edit uses confirmed virtual identity and total-entry fields', async ({ page }) => {
    await page.setViewportSize({ width: mobile ? 390 : 1440, height: 960 }); const state = await fixture(page);
    await page.goto('/meal-plan/planner?date=2026-10-13&task=manual&defaultSlot=2');
    await expect(page.getByRole('heading', { name: 'Add manual food', exact: true })).toBeVisible();
    await expect(page.locator('app-autosave-status')).toHaveCount(0);
    await expect(page.getByText('Save with Add or Update', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add manual food', exact: true }).click();
    await expect(page.locator('app-manual-item-editor [role=alert]')).toBeFocused(); expect(state.writes).toHaveLength(0);
    await fillManual(page); await capture(page, 'f11-manual-' + (mobile ? 'mobile' : 'desktop')); expect(state.writes).toHaveLength(0);
    await page.getByRole('button', { name: 'Add manual food', exact: true }).click();
    await expect(page).toHaveURL(/task=meal.*mealId=77/); expect(state.saved.get('2026-10-13').meals).toHaveLength(1);
    expect(state.writes[0]?.body).toEqual({ meal: { defaultSlot: 2 }, manualItem: { name: 'Trail snack', caloriesKcal: 100.25, proteinG: 1.25, carbsG: 2.5, fatG: 3.75 } });
    await page.getByRole('button', { name: 'Edit manual food Trail snack', exact: true }).click();
    await expect(page).toHaveURL(/task=manual.*mealId=77.*itemId=31/); await expect(page.getByLabel('Food name', { exact: true })).toHaveValue('Trail snack');
    await page.getByLabel('Food name', { exact: true }).fill('Updated food'); await page.getByRole('button', { name: 'Update manual food', exact: true }).click();
    await expect(page.locator('app-meal-editor')).toContainText('Updated food'); expect(state.writes).toHaveLength(2);
    expect(state.writes[1]?.path).toBe('/api/meal-plan/manual-items/31'); expect(state.writes[1]?.body.quantity).toBeUndefined();
    await page.getByRole('button', { name: 'Remove Updated food', exact: true }).click();
    await expect(page.locator('app-meal-editor')).not.toContainText('Updated food'); expect(state.saved.get('2026-10-13').meals).toHaveLength(1);
  });
}

test('manual Cancel protects dirty fields, restores Add trigger and rejects non-manual Edit routes', async ({ page }) => {
  const state = await fixture(page); await page.goto('/meal-plan/planner?date=2026-10-12&task=meal&mealId=20');
  await page.getByRole('button', { name: 'Add manual food', exact: true }).click(); await fillManual(page);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('dialog', { name: 'Leave manual food?' }).getByRole('button', { name: 'Stay', exact: true }).click();
  await expect(page.getByLabel('Food name', { exact: true })).toHaveValue('Trail snack');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.getByRole('button', { name: 'Discard unsent changes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add manual food', exact: true })).toBeFocused(); expect(state.writes).toHaveLength(0);
  await page.goto('/meal-plan/planner?date=2026-10-12&task=manual&mealId=20&itemId=30');
  await expect(page).toHaveURL(/task=meal/); expect(state.writes).toHaveLength(0);
});

test('accessible meal and item moves persist full membership once and restore moved focus', async ({ page }) => {
  const state = await fixture(page); const saved = state.saved.get('2026-10-12'); saved.meals[0].items.push(item(31, 43, 'Second recipe'));
  await page.goto('/meal-plan/planner?date=2026-10-12&task=day');
  await page.getByRole('button', { name: 'Move meal Lunch down', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1); expect(state.writes[0]?.body).toEqual({ orderedIds: [21, 20] });
  await expect(page.getByRole('button', { name: 'Drag meal Lunch', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'View Lunch', exact: true }).click();
  await page.getByRole('button', { name: 'Move item Chicken Rice Bowl down', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(2); expect(state.writes[1]?.body).toEqual({ orderedIds: [31, 30] });
  await expect(page.getByRole('button', { name: 'Drag item Chicken Rice Bowl', exact: true })).toBeFocused();
  await expect(page.getByRole('status').filter({ hasText: 'Moved item to position 2 of 2.' })).toBeVisible();
});

test('pointer drop sends no mutation during motion and matches the keyboard permutation', async ({ page }) => {
  const state = await fixture(page); const saved = state.saved.get('2026-10-12'); saved.meals[0].items.push(item(31, 43, 'Second recipe'));
  await page.goto('/meal-plan/planner?date=2026-10-12&task=meal&mealId=20');
  const handle = page.getByRole('button', { name: 'Drag item Chicken Rice Bowl', exact: true }); await handle.scrollIntoViewIfNeeded();
  const first = await handle.boundingBox(), second = await page.getByRole('button', { name: 'Drag item Second recipe', exact: true }).boundingBox();
  await page.mouse.move(first!.x + 15, first!.y + 15); await page.mouse.down(); await page.mouse.move(first!.x + 15, first!.y + 25, { steps: 4 });
  await page.mouse.move(second!.x + 15, second!.y + 30, { steps: 12 }); expect(state.writes).toHaveLength(0); await page.mouse.up();
  await expect.poll(() => state.writes.length).toBe(1); expect(state.writes[0]?.body).toEqual({ orderedIds: [31, 30] });
});

test('Copy Day distinguishes absent clearing from saved empty and cancelling never submits', async ({ page }) => {
  const state = await fixture(page); await page.goto('/meal-plan/planner?date=2026-10-13&task=day');
  await page.getByRole('button', { name: 'Copy day', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Copy day', exact: true }); await dialog.getByLabel('Destination', { exact: true }).fill('2026-10-12');
  await dialog.getByRole('button', { name: 'Review destination', exact: true }).click();
  await expect(dialog).toContainText('Absent source — clears'); await expect(dialog.getByRole('button', { name: 'Copy day', exact: true })).toBeDisabled();
  await page.screenshot({ path: 'test-results/meal-plan-ui/f13-copy-day-desktop.png', fullPage: true, animations: 'disabled' });
  await page.keyboard.press('Escape'); expect(state.writes).toHaveLength(0); await expect(page.getByRole('button', { name: 'Copy day', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Copy day', exact: true }).click(); dialog = page.getByRole('dialog', { name: 'Copy day', exact: true });
  await dialog.getByLabel('Destination', { exact: true }).fill('2026-10-12'); await dialog.getByRole('button', { name: 'Review destination', exact: true }).click();
  await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Copy day', exact: true }).click();
  await expect(page).toHaveURL(/date=2026-10-12/); expect(state.saved.has('2026-10-12')).toBe(false); expect(state.writes).toHaveLength(1);
  expect(state.writes[0]?.body).toEqual({ sourceDate: '2026-10-13', destinationDate: '2026-10-12', replaceExisting: true });
});

for (const mobile of [false, true]) {
  test((mobile ? 'mobile' : 'desktop') + ' Copy Week reviews seven mappings and sends a single all-or-nothing command', async ({ page }) => {
    await page.setViewportSize({ width: mobile ? 390 : 1440, height: 960 }); const state = await fixture(page);
    const saved = state.saved.get('2026-10-12'); state.saved.set('2026-10-19', { ...structuredClone(saved), date: '2026-10-19' });
    state.saved.set('2026-10-14', { ...structuredClone(saved), date: '2026-10-14', savedMealCount: 0, meals: [] });
    await page.goto('/meal-plan/planner?date=2026-10-12&task=day'); await page.getByRole('button', { name: 'Copy week', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Copy week', exact: true }); await dialog.getByLabel('Destination Monday', { exact: true }).fill('2026-10-19');
    await dialog.getByRole('button', { name: 'Review destination week', exact: true }).click(); await expect(dialog.locator('ol.mappings > li')).toHaveCount(7);
    await expect(dialog).toContainText('Saved empty day'); await dialog.getByRole('checkbox').check();
    await dialog.locator('mat-dialog-content').evaluate(element => element.scrollTop = 0);
    await page.screenshot({ path: 'test-results/meal-plan-ui/f14-copy-week-' + (mobile ? 'mobile' : 'desktop') + '.png', fullPage: true, animations: 'disabled' });
    await dialog.getByRole('button', { name: 'Copy week', exact: true }).click(); await expect(dialog).toHaveCount(0);
    expect(state.writes).toHaveLength(1); expect(state.writes[0]?.path).toBe('/api/meal-plan/copy-week');
    expect(state.writes[0]?.body).toEqual({ sourceMonday: '2026-10-12', destinationMonday: '2026-10-19', replaceExisting: true });
    expect(state.saved.get('2026-10-21').meals).toHaveLength(0); expect(state.saved.get('2026-10-21').persistence).toBe('saved');
    expect(state.saved.has('2026-10-20')).toBe(false);
  });
}

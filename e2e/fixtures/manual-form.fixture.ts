import { Page } from '@playwright/test';
export async function fillManual(page: Page, name = 'Trail snack') {
  for (const [label, value] of [['Food name', name], ['Calories (kcal)', '100.25'], ['Protein (g)', '1.25'], ['Carbs (g)', '2.50'], ['Fat (g)', '3.75']]) {
    await page.getByLabel(label!, { exact: true }).fill(value!);
  }
}

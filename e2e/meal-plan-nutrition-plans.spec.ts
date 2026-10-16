import { expect, test } from '@playwright/test';
import { fixture } from './fixtures/meal-plan.fixture';

for (const mobile of [false, true]) {
  test((mobile ? 'mobile' : 'desktop') + ' confirmed Easy create/edit/duplicate/Current/delete stays separate from dated food', async ({ page }) => {
    await page.setViewportSize({ width: mobile ? 390 : 1440, height: 960 }); const planner = await fixture(page);
    const originalFood = structuredClone([...planner.saved.entries()]);
    let revision = 8, currentId: number | null = null, nextId = 1; const plans = new Map<number, any>(), writes: { path: string; body: any }[] = [];
    const settings = () => ({ currentNutritionPlanId: currentId, currentPlan: currentId === null ? null : { id: currentId, name: plans.get(currentId).name, mode: 'easy', defaultMealsPerDay: plans.get(currentId).defaultMealsPerDay, targets: null, calculationPolicyVersion: null } });
    await page.route('**/api/nutrition-plans**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname, id = Number(path.split('/')[3]), body = request.postData() ? request.postDataJSON() : null;
      const json = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (request.method() === 'GET') return json(path === '/api/nutrition-plans' ? { revision: String(revision), settings: settings(), plans: [...plans.values()] }
        : { revision: String(revision), settings: settings(), plan: plans.get(id), profileDiffers: false });
      expect(request.headers()['x-csrf-token']).toBe('planner-test-only'); expect(request.headers()['x-meal-plan-revision']).toBe(String(revision)); writes.push({ path, body });
      let plan = null, deletedPlanId = null;
      if (request.method() === 'POST' && path.endsWith('/duplicate')) {
        plan = { ...plans.get(id), id: nextId++, name: plans.get(id).name + ' (copy)' }; plans.set(plan.id, plan);
      } else if (request.method() === 'POST') {
        plan = { id: nextId++, ...body, goal: null, activityLevel: null, targets: null, calculationPolicyVersion: null, calculationInputs: null, rmrKcal: null, maintenanceKcal: null, calculatedAt: null, warnings: [], createdAt: '2026-10-15T12:00:00Z', updatedAt: '2026-10-15T12:00:00Z' };
        plans.set(plan.id, plan); if (currentId === null) currentId = plan.id;
      } else if (request.method() === 'PUT') { plan = { ...plans.get(id), ...body }; plans.set(id, plan); }
      else { plans.delete(id); deletedPlanId = id; if (currentId === id) currentId = null; }
      revision++; return json({ revision: String(revision), settings: settings(), plan, deletedPlanId, profile: null, plannerInvalidated: true }, request.method() === 'POST' ? 201 : 200);
    });
    await page.route('**/api/meal-plan/current-nutrition-plan', async route => {
      const body = route.request().postDataJSON(); writes.push({ path: '/api/meal-plan/current-nutrition-plan', body }); currentId = body.nutritionPlanId; revision++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ revision: String(revision), settings: settings(), plan: plans.get(currentId!), deletedPlanId: null, profile: null, plannerInvalidated: true }) });
    });
    await page.goto('/meal-plan/nutrition-plans/create/easy'); await page.getByLabel('Plan name', { exact: true }).fill('Easy week');
    await page.getByRole('radio', { name: '4 meals / day', exact: true }).check();
    await page.getByRole('button', { name: 'Create Easy plan', exact: true }).click(); await expect(page).toHaveURL(/nutrition-plans$/);
    await expect(page.getByRole('article', { name: 'Easy week', exact: true })).toContainText('Current'); expect(writes[0]?.body).toEqual({ name: 'Easy week', mode: 'easy', defaultMealsPerDay: 4 });
    await page.getByRole('button', { name: 'Edit Easy week', exact: true }).click(); await page.getByLabel('Plan name', { exact: true }).fill('Edited week');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await expect(page).toHaveURL(/nutrition-plans$/);
    await page.getByRole('button', { name: 'More actions for Edited week', exact: true }).click(); await page.getByRole('menuitem', { name: 'Duplicate Edited week', exact: true }).click();
    await expect(page.getByRole('article', { name: 'Edited week (copy)', exact: true })).not.toContainText('Current');
    await page.getByRole('button', { name: 'Use this plan: Edited week (copy)', exact: true }).click(); await expect(page.getByRole('article', { name: 'Edited week (copy)', exact: true })).toContainText('Current');
    await page.getByRole('button', { name: 'More actions for Edited week (copy)', exact: true }).click(); await page.getByRole('menuitem', { name: 'Delete Edited week (copy)', exact: true }).click();
    await page.getByRole('dialog', { name: 'Delete nutrition plan', exact: true }).getByRole('button', { name: /Delete/ }).click();
    await expect(page.getByRole('article', { name: 'Edited week (copy)', exact: true })).toHaveCount(0); expect(currentId).toBeNull();
    expect([...planner.saved.entries()]).toEqual(originalFood); expect(planner.writes).toHaveLength(0);
  });
}

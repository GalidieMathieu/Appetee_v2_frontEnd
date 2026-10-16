import { expect, Page } from '@playwright/test';
export const zero = { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
const nutrition = { caloriesKcal: 560, proteinG: 52, carbsG: 62, fatG: null };
const targets = { caloriesKcal: 2500, proteinG: 130, carbsG: 300, fatG: 75 };
const settings = { currentNutritionPlanId: 1, currentPlan: { id: 1, name: 'Training', mode: 'intermediate', defaultMealsPerDay: 3, targets, calculationPolicyVersion: '2026.1' } };
const card = (id: number, name: string) => ({ id, name, description: 'A balanced recipe with fresh vegetables.', cardImageUrl: null, totalTimeMinutes: 25, caloriesPerServing: 560, proteinPerServing: 52, carbsPerServing: 62, fatPerServing: null, estimatedCostPerServing: 4, badges: ['HighProtein'], featuredIngredients: [], isSaved: id === 43 });
export const item = (id = 30, recipeId = 42, name = 'Chicken Rice Bowl') => ({ id, type: 'recipe', sortOrder: 1, recipeId, quantity: 1, availability: 'available', name, perServing: nutrition, nutrition, warnings: ['recipe_fat_unknown'] });
export const meal = (id = 20, name = 'Lunch') => ({ id, key: 'meal:' + id, isVirtual: false, defaultSlot: null, name, sortOrder: 1, items: [item()], totals: nutrition, warnings: ['recipe_fat_unknown'] });
export function createFixtureState() {
  const state = { revision: 8, writes: [] as { path: string; body: any; revision: string | undefined }[], saved: new Map<string, any>(), holdRename: false, holdManual: false, release: null as null | (() => void), error: 0, authenticated: true, readHook: null as null | ((from: string, through: string) => void), nextItemId: 31, nextMealId: 77, pickerReads: [] as string[] };
  state.saved.set('2026-10-12', { date: '2026-10-12', id: 10, persistence: 'saved', savedMealCount: 2, meals: [meal(), { ...meal(21, 'Dinner'), items: [], totals: zero }], totals: nutrition, targets, remaining: targets, warnings: ['recipe_fat_unknown'] });
  return state;
}
export async function fixture(page: Page, shared?: ReturnType<typeof createFixtureState>) {
  const state = shared ?? createFixtureState();
  const virtualDay = (date: string) => ({ date, id: null, persistence: 'untouched', savedMealCount: 0, meals: ['Breakfast', 'Lunch', 'Dinner'].map((name, index) => ({ id: null, key: 'virtual:' + date + ':' + (index + 1), isVirtual: true, defaultSlot: index + 1, name, sortOrder: index + 1, items: [], totals: zero, warnings: [] })), totals: zero, targets, remaining: targets, warnings: [] });
  const day = (date: string) => state.saved.get(date) ?? virtualDay(date);
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/auth/session') return state.authenticated ? json({ userId: 1, username: 'mathieu', permissions: [] }) : json({ code: 'session_expired' }, 401);
    if (path === '/api/auth/csrf') return json({ requestToken: 'planner-test-only', headerName: 'X-CSRF-TOKEN' });
    if (path === '/api/users/me') return json({ username: 'mathieu' });
    if (path === '/api/auth/logout') { state.authenticated = false; return route.fulfill({ status: 204 }); }
    if (path.startsWith('/api/meal-plan/') && !state.authenticated) return json({ code: 'session_expired' }, 401);
    if (path === '/api/meal-plan/days') {
      const from = url.searchParams.get('from')!, through = url.searchParams.get('through')!, days = [];
      state.readHook?.(from, through);
      const cursor = new Date(from + 'T12:00:00Z');
      while (cursor.toISOString().slice(0, 10) <= through) { days.push(day(cursor.toISOString().slice(0, 10))); cursor.setUTCDate(cursor.getUTCDate() + 1); }
      return json({ revision: String(state.revision), settings, from, through, days });
    }
    if (path === '/api/recipes/meal-plan') {
      state.pickerReads.push(url.search); return json({ items: url.searchParams.get('savedOnly') ? [card(43, 'Salmon Quinoa Bowl')] : [card(42, 'Chicken Rice Bowl'), card(43, 'Salmon Quinoa Bowl'), card(44, 'Tofu Stir Fry')], nextCursor: null, hasMore: false });
    }
    if (request.method() === 'GET') return json({}, 404);
    const body = request.postData() ? request.postDataJSON() : null;
    state.writes.push({ path, body, revision: request.headers()['x-meal-plan-revision'] });
    expect(request.headers()['x-csrf-token']).toBe('planner-test-only');
    if (state.error) return json({ code: state.error === 409 ? 'meal_plan_revision_conflict' : 'csrf_invalid' }, state.error);
    if (request.headers()['x-meal-plan-revision'] !== String(state.revision)) return json({ code: 'meal_plan_revision_conflict' }, 409);
    if (path.startsWith('/api/meal-plan/meals/') && request.method() === 'PATCH' && state.holdRename) await new Promise<void>(resolve => state.release = resolve);
    if (path.endsWith('/manual-items') && state.holdManual) await new Promise<void>(resolve => state.release = resolve);
    const childId = Number(path.split('/')[4]);
    const owned = [...state.saved.values()].find((value: any) => path.includes('/meals/') ? value.meals.some((parent: any) => parent.id === childId)
      : value.meals.some((parent: any) => parent.items.some((entry: any) => entry.id === childId)));
    let affected = owned ?? day('2026-10-12'), createdMealId: number | null = null, createdItemId: number | null = null;
    if (path.endsWith('/copy-day') || path.endsWith('/copy-week')) {
      const week = path.endsWith('/copy-week'), start = body.sourceDate ?? body.sourceMonday, target = body.destinationDate ?? body.destinationMonday;
      const shift = (date: string, offset: number) => { const value = new Date(date + 'T12:00:00Z'); value.setUTCDate(value.getUTCDate() + offset); return value.toISOString().slice(0, 10); };
      const sources = Array.from({ length: week ? 7 : 1 }, (_, index) => JSON.parse(JSON.stringify(day(shift(start, index)))));
      const days = sources.map((source: any, index) => {
        const date = shift(target, index);
        if (source.persistence === 'untouched') { state.saved.delete(date); return virtualDay(date); }
        const copied = { ...source, date, id: 100 + index, meals: source.meals.map((parent: any) => {
          const id = state.nextMealId++;
          return { ...parent, id, key: 'meal:' + id, items: parent.items.map((entry: any) => ({ ...entry, id: state.nextItemId++ })) };
        }) };
        state.saved.set(date, copied); return copied;
      });
      state.revision++;
      return json({ revision: String(state.revision), settings, days, createdMealId: null, createdItemId: null });
    }
    if (path.includes('/manual-items') && request.method() === 'POST') {
      const date = path.split('/')[4]!, current = day(date), parent = body.meal.mealId ?? state.nextMealId++;
      const details = body.manualItem, created = { id: state.nextItemId++, type: 'manual', sortOrder: 2, name: details.name,
        nutrition: { caloriesKcal: details.caloriesKcal, proteinG: details.proteinG, carbsG: details.carbsG, fatG: details.fatG } };
      affected = { ...current, id: 10, persistence: 'saved', savedMealCount: current.persistence === 'saved' ? current.savedMealCount : 1,
        meals: current.persistence === 'saved' ? current.meals.map((value: any) => value.id === parent ? { ...value, items: [...value.items, created] } : value)
          : [{ ...meal(parent, current.meals[body.meal.defaultSlot-1].name), items: [created] }] };
      createdMealId = current.persistence === 'saved' ? null : parent; createdItemId = created.id;
    } else if (path.includes('/manual-items/') && request.method() === 'PUT') {
      const id = Number(path.split('/').at(-1));
      const { name, ...nutrition } = body;
      affected = { ...affected, meals: affected.meals.map((value: any) => ({ ...value, items: value.items.map((entry: any) => entry.id === id ? { ...entry, name, nutrition } : entry) })) };
    } else if (path.includes('/meal-order')) {
      affected = { ...affected, meals: body.orderedIds.map((id: number, index: number) => ({ ...affected.meals.find((value: any) => value.id === id), sortOrder: index + 1 })) };
    } else if (path.includes('/item-order')) {
      const parentId = Number(path.split('/').at(-2));
      affected = { ...affected, meals: affected.meals.map((value: any) => value.id === parentId ? { ...value, items: body.orderedIds.map((id: number, index: number) => ({ ...value.items.find((entry: any) => entry.id === id), sortOrder: index + 1 })) } : value) };
    } else if (/days\/.+\/meals$/.test(path)) {
      const date = path.split('/')[4]!, current = day(date);
      const created = { ...meal(state.nextMealId++, body.name), items: [], totals: zero, sortOrder: current.savedMealCount + 1 };
      affected = { ...current, id: 10, persistence: 'saved', savedMealCount: current.persistence === 'saved' ? current.savedMealCount + 1 : 1, meals: current.persistence === 'saved' ? [...current.meals, created] : [created] };
      createdMealId = created.id;
    } else if (path.includes('/recipe-items') && request.method() === 'POST') {
      const date = path.split('/')[4]!, current = day(date), parent = body.meal.mealId ?? state.nextMealId++;
      const created = item(31, body.recipeId, body.recipeId === 43 ? 'Salmon Quinoa Bowl' : 'Chicken Rice Bowl');
      affected = { ...current, id: 10, persistence: 'saved', savedMealCount: current.persistence === 'saved' ? current.savedMealCount : 1,
        meals: current.persistence === 'saved' ? current.meals.map((value: any) => value.id === parent ? { ...value, items: [...value.items, created] } : value) : [{ ...meal(parent, current.meals[body.meal.defaultSlot - 1].name), items: [created] }] };
      createdMealId = current.persistence === 'saved' ? null : parent; createdItemId = 31;
    } else if (path.includes('/quantity')) {
      affected = { ...affected, meals: affected.meals.map((value: any) => ({ ...value, items: value.items.map((entry: any) => entry.id === 30 ? { ...entry, quantity: body.quantity } : entry) })) };
    } else if (path.includes('/meals/')) {
      const id = Number(path.split('/').at(-1));
      affected = { ...affected, meals: request.method() === 'DELETE' ? affected.meals.filter((value: any) => value.id !== id) : affected.meals.map((value: any) => value.id === id ? { ...value, name: body.name } : value) };
      affected.savedMealCount = affected.meals.length;
    } else if (path.includes('/items/')) {
      const id = Number(path.split('/').at(-1)); affected = { ...affected, meals: affected.meals.map((value: any) => ({ ...value, items: value.items.filter((entry: any) => entry.id !== id) })) };
    }
    state.saved.set(affected.date, affected); state.revision++;
    return json({ revision: String(state.revision), settings, days: [affected], createdMealId, createdItemId }, request.method() === 'POST' ? 201 : 200);
  });
  return state;
}

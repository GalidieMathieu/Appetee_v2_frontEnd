import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '@app/core/api/api.config';
import { MEAL_PLAN_REVISION_HEADER, PlannerMutationDto } from './meal-plan-mutation.model';
import { MealPlannerApi } from './meal-planner.api';
describe('MealPlannerApi', () => {
    let api: MealPlannerApi;
    let http: HttpTestingController;
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                MealPlannerApi,
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: API_URL, useValue: '/api' },
            ],
        });
        api = TestBed.inject(MealPlannerApi);
        http = TestBed.inject(HttpTestingController);
    });
    afterEach(() => http.verify());
    it('loads only the requested inclusive date range', () => {
        api.getRange('2026-10-05', '2026-10-11').subscribe();
        const request = http.expectOne(candidate => candidate.url === '/api/meal-plan/days'
            && candidate.params.get('from') === '2026-10-05'
            && candidate.params.get('through') === '2026-10-11');
        expect(request.request.method).toBe('GET');
        expect(request.request.params.keys().sort()).toEqual(['from', 'through']);
        request.flush({});
    });
    it('serializes meal commands with exact bodies and the opaque revision header', () => {
        api.createMeal('2026-10-05', { name: 'Lunch', defaultSlot: 2 }, '9007199254740993').subscribe();
        flushMutation('POST', '/api/meal-plan/days/2026-10-05/meals', {
            name: 'Lunch',
            defaultSlot: 2,
        });
        api.renameMeal(12, { name: 'Late lunch' }, '9007199254740993').subscribe();
        flushMutation('PATCH', '/api/meal-plan/meals/12', { name: 'Late lunch' });
        api.deleteMeal(12, '9007199254740993').subscribe();
        flushMutation('DELETE', '/api/meal-plan/meals/12', null);
        api.reorderMeals('2026-10-05', { orderedIds: [12, 14] }, '9007199254740993').subscribe();
        flushMutation('PUT', '/api/meal-plan/days/2026-10-05/meal-order', {
            orderedIds: [12, 14],
        });
    });
    it('serializes recipe and manual item commands without owner or target overposting', () => {
        api.addRecipeItem('2026-10-05', { meal: { defaultSlot: 2 }, recipeId: 88, quantity: 1 }, '8').subscribe();
        flushMutation('POST', '/api/meal-plan/days/2026-10-05/recipe-items', {
            meal: { defaultSlot: 2 },
            recipeId: 88,
            quantity: 1,
        }, '8');
        api.setRecipeQuantity(31, { quantity: 4 }, '9').subscribe();
        flushMutation('PUT', '/api/meal-plan/recipe-items/31/quantity', { quantity: 4 }, '9');
        const manualItem = {
            name: 'Protein shake',
            caloriesKcal: 240,
            proteinG: 30,
            carbsG: 12,
            fatG: 8,
        };
        api.addManualItem('2026-10-05', { meal: { mealId: 12 }, manualItem }, '10').subscribe();
        flushMutation('POST', '/api/meal-plan/days/2026-10-05/manual-items', {
            meal: { mealId: 12 },
            manualItem,
        }, '10');
        api.updateManualItem(44, manualItem, '11').subscribe();
        flushMutation('PUT', '/api/meal-plan/manual-items/44', manualItem, '11');
        api.deleteItem(44, '12').subscribe();
        flushMutation('DELETE', '/api/meal-plan/items/44', null, '12');
        api.reorderItems(12, { orderedIds: [31, 44] }, '13').subscribe();
        flushMutation('PUT', '/api/meal-plan/meals/12/item-order', { orderedIds: [31, 44] }, '13');
    });
    it('uses one atomic request for copy day and copy week', () => {
        api.copyDay({
            sourceDate: '2026-10-05',
            destinationDate: '2026-10-12',
            replaceExisting: true,
        }, '14').subscribe();
        flushMutation('POST', '/api/meal-plan/copy-day', {
            sourceDate: '2026-10-05',
            destinationDate: '2026-10-12',
            replaceExisting: true,
        }, '14');
        api.copyWeek({
            sourceMonday: '2026-10-05',
            destinationMonday: '2026-10-12',
            replaceExisting: false,
        }, '15').subscribe();
        flushMutation('POST', '/api/meal-plan/copy-week', {
            sourceMonday: '2026-10-05',
            destinationMonday: '2026-10-12',
            replaceExisting: false,
        }, '15');
    });
    function flushMutation(method: string, url: string, body: unknown, revision = '9007199254740993'): void {
        const request = http.expectOne(url);
        expect(request.request.method).toBe(method);
        expect(request.request.body).toEqual(body);
        expect(request.request.headers.get(MEAL_PLAN_REVISION_HEADER)).toBe(revision);
        if (body && typeof body === 'object') {
            expect('ownerId' in body).toBe(false);
            expect('userId' in body).toBe(false);
            expect('targets' in body).toBe(false);
        }
        request.flush({} as PlannerMutationDto);
    }
});

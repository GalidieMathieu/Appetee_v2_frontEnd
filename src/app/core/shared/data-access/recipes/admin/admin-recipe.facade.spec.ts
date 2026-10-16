/**
 * Admin mutation tests protect multipart authority boundaries and shared read-model invalidation.
 * An updated recipe cannot leave stale detail, Preview, Cooking View, or query data cached.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { RecipeDetailRequest, RecipeSummaryDto } from '../recipe.model';
import { RecipesFacade } from '../recipe.facade';
import { AdminRecipeApi } from './admin-recipe.api';
import { AdminRecipeFacade } from './admin-recipe.facade';
import { CapabilitiesStore } from '@app/core/auth/data-access/capabilities.store';
import { CatalogueStateStore } from '../../catalogue/catalogue-state.store';
import { AdminRecipeStore } from './admin-recipe.store';

describe('AdminRecipeFacade', () => {
  const create = vi.fn();
  const update = vi.fn();
  const invalidateDetail = vi.fn();
  const invalidatePreview = vi.fn();
  const invalidateCookingView = vi.fn();
  const invalidateQueries = vi.fn();

  beforeEach(() => {
    create.mockReset();
    update.mockReset();
    invalidateDetail.mockReset();
    invalidatePreview.mockReset();
    invalidateCookingView.mockReset();
    invalidateQueries.mockReset();
    create.mockReturnValue(of(record(createSummary())));
    update.mockReturnValue(of(createSummary()));

    TestBed.configureTestingModule({
      providers: [
        AdminRecipeFacade,
        AdminRecipeStore,
        {
          provide: AdminRecipeApi,
          useValue: { create, update, getDetail: vi.fn(() => of(record({ ...createSummary(), instructions: [], ingredients: [], description: 'Saved', cookTimeMinutes: 25, totalTimeMinutes: 45 }))) },
        },
        {
          provide: RecipesFacade,
          useValue: {
            invalidateDetail,
            invalidatePreview,
            invalidateCookingView,
            invalidateQueries,
          },
        },
      ],
    });
  });

  beforeEach(() => {
    TestBed.inject(CapabilitiesStore).accept({ userId: 1, username: 'author', permissions: ['Catalog.ReadAdmin','Catalog.Write'] });
    const catalogue = TestBed.inject(CatalogueStateStore);
    catalogue.reviewedEtags.set({ 42: '\"catalog-recipe-42-v1\"' });
    catalogue.recipeRequests.set({ 42: { status: 'success', error: null } });
  });

  it.each([
    ['create', () => TestBed.inject(AdminRecipeFacade).createRecipeWithDetails(createRequest())],
    ['update', () => TestBed.inject(AdminRecipeFacade).updateRecipeWithDetails(42, createRequest())],
  ])('omits canonical totals from the %s FormData', async (_, runRequest) => {
    await firstValueFrom(runRequest());

    const formData = (create.mock.calls[0]?.[0] ?? update.mock.calls[0]?.[1]) as FormData;
    expect(Array.from(formData.keys())).not.toEqual(
      expect.arrayContaining([
        'caloriesTotal',
        'proteinTotal',
        'carbsTotal',
        'caloriesPerServing',
        'proteinPerServing',
        'estimatedCostPerServing',
      ])
    );
    expect(formData.get('name')).toBe('Soup');
    expect(formData.get('description')).toBe('A warming vegetable soup.');
    expect(formData.get('prepTimeMinutes')).toBe('15');
    expect(formData.get('cookTimeMinutes')).toBe('25');
    expect(formData.get('totalTimeMinutes')).toBe('45');
    expect(formData.get('ingredients[0].ingredientId')).toBe('7');
    expect(formData.get('ingredients[0].featuredOrder')).toBe('1');
    expect(formData.get('instructions[0].title')).toBe('Prepare');
    expect(formData.get('instructions[0].instruction')).toBe('Cook');
    expect(formData.has('instructions[0]')).toBe(false);
  });

  it.each([
    [401, 'You are not authorized. Please sign in again.'],
    [403, 'You do not have permission to perform this action.'],
  ])('surfaces a safe message when admin authoring returns %s', async (status, message) => {
    create.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status }))
    );
    const facade = TestBed.inject(AdminRecipeFacade);

    const result = await firstValueFrom(
      facade.createRecipeWithDetails(createRequest()),
      { defaultValue: null }
    );

    expect(result).toBeNull();
    expect(await firstValueFrom(facade.error$)).toBe(message);
    expect(await firstValueFrom(facade.isLoading$)).toBe(false);
  });

  it('returns the successful admin authoring response', async () => {
    const facade = TestBed.inject(AdminRecipeFacade);

    expect(await firstValueFrom(facade.createRecipeWithDetails(createRequest())))
      .toEqual(createSummary());
    expect(await firstValueFrom(facade.error$)).toBeNull();
  });

  it('invalidates detail, Preview, Cooking View, and discovery after an update', async () => {
    const facade = TestBed.inject(AdminRecipeFacade);

    await firstValueFrom(facade.updateRecipeWithDetails(42, createRequest()));

    expect(invalidateDetail).toHaveBeenCalledWith(42);
    expect(invalidatePreview).toHaveBeenCalledWith(42);
    expect(invalidateCookingView).toHaveBeenCalledWith(42);
    expect(invalidateQueries).toHaveBeenCalledOnce();
  });
  it.each([412, 428])('preserves the originating token on %s and requires explicit fresh review without replay', async status => {
    const facade = TestBed.inject(AdminRecipeFacade); const catalogue = TestBed.inject(CatalogueStateStore);
    update.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    await firstValueFrom(facade.updateRecipeWithDetails(42, createRequest()), { defaultValue: null });
    expect(catalogue.reviewRequired()[42]).toBe(true); expect(update).toHaveBeenCalledTimes(1);
    expect(catalogue.reviewedEtags()[42]).toBe('"catalog-recipe-42-v1"');
    await firstValueFrom(facade.loadDetail(42));
    await firstValueFrom(facade.updateRecipeWithDetails(42, createRequest()), { defaultValue: null });
    expect(update).toHaveBeenCalledTimes(1);
    facade.confirmReview(42); expect(catalogue.reviewRequired()[42]).toBe(false);
    expect(update).toHaveBeenCalledTimes(1);
  });
  it('does not retry a rejected CSRF mutation or alter its resource token', async () => {
    update.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { code: 'csrf_invalid' } })));
    const facade = TestBed.inject(AdminRecipeFacade);
    await firstValueFrom(facade.updateRecipeWithDetails(42, createRequest()), { defaultValue: null });
    expect(update).toHaveBeenCalledTimes(1); expect(update.mock.calls[0]?.[2]).toBe('"catalog-recipe-42-v1"');
    expect(TestBed.inject(CatalogueStateStore).reviewedEtags()[42]).toBe('"catalog-recipe-42-v1"');
  });
  it('does not enable administrative creation for a read-only moderator', async () => {
    TestBed.inject(CapabilitiesStore).accept({ userId: 1, username: 'reader', permissions: ['Catalog.ReadAdmin'] });
    expect(await firstValueFrom(TestBed.inject(AdminRecipeFacade).createRecipeWithDetails(createRequest()), { defaultValue: null })).toBeNull();
    expect(create).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
  });
  it('invalidates the resource and its token after 404 without replay', async () => {
    update.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    await firstValueFrom(TestBed.inject(AdminRecipeFacade).updateRecipeWithDetails(42, createRequest()), { defaultValue: null });
    expect(TestBed.inject(CatalogueStateStore).reviewedEtags()[42]).toBeUndefined(); expect(update).toHaveBeenCalledTimes(1);
  });
  it('blocks blind creation repeat after an unknown transport outcome', async () => {
    create.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const facade = TestBed.inject(AdminRecipeFacade);
    await firstValueFrom(facade.createRecipeWithDetails(createRequest()), { defaultValue: null });
    await firstValueFrom(facade.createRecipeWithDetails(createRequest()), { defaultValue: null });
    expect(create).toHaveBeenCalledTimes(1); expect(TestBed.inject(CatalogueStateStore).createOutcomeUnknown()).toBe(true);
  });
  it('rejects a pre-write detail response instead of restoring an older ETag', async () => {
    const oldRead = new Subject<any>(); const newRead = new Subject<any>();
    const api = TestBed.inject(AdminRecipeApi); const getDetail = vi.spyOn(api, 'getDetail').mockReturnValueOnce(oldRead).mockReturnValueOnce(newRead);
    const facade = TestBed.inject(AdminRecipeFacade); const catalogue = TestBed.inject(CatalogueStateStore);
    const received: unknown[] = []; facade.loadDetail(42).subscribe(value => received.push(value));
    update.mockReturnValue(of({ ...record(createSummary()), resourceVersion: '2', etag: '"catalog-recipe-42-v2"' }));
    // The originating protected read is available, but another revalidation is in flight.
    catalogue.recipeRequests.set({42:{status:'success',error:null}});
    await firstValueFrom(facade.updateRecipeWithDetails(42,createRequest()));
    expect(getDetail).toHaveBeenCalledTimes(2);
    newRead.next({ ...record({ ...createSummary(), description: 'Confirmed', instructions: [], ingredients: [], cookTimeMinutes: 25, totalTimeMinutes: 45 }), resourceVersion: '2', etag: '"catalog-recipe-42-v2"' }); newRead.complete();
    oldRead.next(record({ ...createSummary(), description: 'Old', instructions: [], ingredients: [], cookTimeMinutes: 25, totalTimeMinutes: 45 })); oldRead.complete();
    expect(received).toEqual([]); expect(catalogue.recipes()[42]?.resourceVersion).toBe('2'); expect(catalogue.reviewedEtags()[42]).toBe('"catalog-recipe-42-v2"');
  });
  it('requires review when the protected follow-up read observes another writer after an own confirmation', async () => {
    const api = TestBed.inject(AdminRecipeApi); vi.spyOn(api, 'getDetail').mockReturnValue(of({ ...record({ ...createSummary(), description: 'Another writer', instructions: [], ingredients: [], cookTimeMinutes: 25, totalTimeMinutes: 45 }), resourceVersion: '3', etag: '"catalog-recipe-42-v3"' }));
    update.mockReturnValue(of({ ...record(createSummary()), resourceVersion: '2', etag: '"catalog-recipe-42-v2"' }));
    const facade = TestBed.inject(AdminRecipeFacade); await firstValueFrom(facade.updateRecipeWithDetails(42,createRequest()));
    const catalogue = TestBed.inject(CatalogueStateStore); expect(catalogue.reviewRequired()[42]).toBe(true);
    await firstValueFrom(facade.updateRecipeWithDetails(42,createRequest()),{defaultValue:null}); expect(update).toHaveBeenCalledTimes(1);
  });
  it('ignores a late old-session mutation result without restoring records or clearing new request state', async () => {
    const response = new Subject<any>(); update.mockReturnValue(response);
    const facade = TestBed.inject(AdminRecipeFacade); const result = firstValueFrom(facade.updateRecipeWithDetails(42,createRequest()),{defaultValue:null});
    const catalogue = TestBed.inject(CatalogueStateStore); catalogue.reset(); response.next(record(createSummary())); response.complete();
    expect(await result).toBeNull(); expect(catalogue.recipes()).toEqual({}); expect(catalogue.reviewedEtags()).toEqual({}); expect(invalidateQueries).not.toHaveBeenCalled(); expect(update).toHaveBeenCalledTimes(1);
  });
});

function createRequest(): RecipeDetailRequest {
  return {
    name: 'Soup',
    description: 'A warming vegetable soup.',
    image: null,
    instructions: [{ title: 'Prepare', instruction: 'Cook' }],
    prepTimeMinutes: 15,
    cookTimeMinutes: 25,
    totalTimeMinutes: 45,
    servings: 2,
    difficulty: 'Easy',
    badges: [],
    dietIds: [],
    ingredients: [{ ingredientId: 7, quantity: 100, unit: 'g', featuredOrder: 1 }],
  };
}

function createSummary(): RecipeSummaryDto {
  return {
    id: 42,
    name: 'Soup',
    previewImageUrl: 'https://cdn.example.com/previews/soup.jpg',
    prepTimeMinutes: 15,
    servings: 2,
    difficulty: 'Easy',
    badges: [],
    diets: [],
    ingredients: [{ id: 7, name: 'Carrot' }],
    caloriesTotal: 120,
    proteinTotal: 4,
    carbsTotal: 20,
    caloriesPerServing: 60,
    proteinPerServing: 2,
    estimatedCostPerServing: 1.5,
  };
}
function record<T extends {id:number}>(resource:T) { return {resource,resourceVersion:'1',createdByUserId:null,updatedByUserId:null,etag:'"catalog-recipe-'+resource.id+'-v1"'}; }

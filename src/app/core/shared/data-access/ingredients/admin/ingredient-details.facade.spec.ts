import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AdminIngredientApi } from './admin-ingredient.api';
import { AdminIngredientFacade } from './admin-ingredient.facade';
import { AdminIngredientStore } from './admin-ingredient.store';
import { IngredientDetailsFacade } from './ingredient-details.facade';
import { IngredientDetailsStore } from './ingredient-details.store';
import { IngredientAdminDetailDto, IngredientAdminDetailRequest } from '../ingredient.model';
import { IngredientsStore } from '../ingredients.store';

describe('ingredient data access boundaries', () => {
  const getDetail = vi.fn();
  const create = vi.fn();

  beforeEach(() => {
    getDetail.mockReset();
    create.mockReset();
    TestBed.configureTestingModule({
      providers: [
        IngredientDetailsFacade,
        AdminIngredientFacade,
        IngredientDetailsStore,
        IngredientsStore,
        AdminIngredientStore,
        { provide: AdminIngredientApi, useValue: { getDetail, create } },
      ],
    });
  });

  it('coalesces a duplicate detail request and serves later access from cache', async () => {
    const pending = new Subject<IngredientAdminDetailDto>();
    getDetail.mockReturnValue(pending);
    const facade = TestBed.inject(IngredientDetailsFacade);

    const first = firstValueFrom(facade.get(1));
    const duplicate = firstValueFrom(facade.get(1));
    pending.next(detail(1));
    pending.complete();

    await Promise.all([first, duplicate]);
    expect(await firstValueFrom(facade.get(1))).toEqual(detail(1));
    expect(getDetail).toHaveBeenCalledTimes(1);
  });

  it('loads different ingredient IDs concurrently with independent request state', async () => {
    const firstPending = new Subject<IngredientAdminDetailDto>();
    const secondPending = new Subject<IngredientAdminDetailDto>();
    getDetail.mockImplementation((id: number) => id === 1 ? firstPending : secondPending);
    const facade = TestBed.inject(IngredientDetailsFacade);

    const first = firstValueFrom(facade.get(1));
    const second = firstValueFrom(facade.get(2));
    expect(facade.requestState(1).status).toBe('loading');
    expect(facade.requestState(2).status).toBe('loading');

    firstPending.next(detail(1));
    firstPending.complete();
    expect(await first).toEqual(detail(1));
    expect(facade.requestState(1).status).toBe('success');
    expect(facade.requestState(2).status).toBe('loading');

    secondPending.next(detail(2));
    secondPending.complete();
    await second;
  });

  it('keeps a detail error scoped to its ID and separate from catalogue state', async () => {
    getDetail.mockReturnValue(throwError(() => new Error('detail failed')));
    const catalogue = TestBed.inject(IngredientsStore);
    const details = TestBed.inject(IngredientDetailsFacade);
    catalogue.setLoading();

    await firstValueFrom(details.get(3), { defaultValue: null });

    expect(catalogue.isLoading()).toBe(true);
    expect(details.requestState(3)).toEqual({ status: 'error', error: 'detail failed' });
  });

  it('allows creation while the catalogue is loading and synchronizes both caches', async () => {
    create.mockReturnValue(of(detail(4)));
    const catalogue = TestBed.inject(IngredientsStore);
    const details = TestBed.inject(IngredientDetailsStore);
    const admin = TestBed.inject(AdminIngredientFacade);
    catalogue.setLoading();

    expect(await firstValueFrom(admin.create(createRequest()))).toEqual(detail(4));

    expect(create).toHaveBeenCalledTimes(1);
    expect(details.get(4)).toEqual(detail(4));
    expect(await firstValueFrom(catalogue.data$)).toEqual([{ id: 4, name: 'Ingredient 4' }]);
  });

  it('keeps mutation errors separate from catalogue and detail request state', async () => {
    create.mockReturnValue(throwError(() => new Error('create failed')));
    const catalogue = TestBed.inject(IngredientsStore);
    const details = TestBed.inject(IngredientDetailsFacade);
    const admin = TestBed.inject(AdminIngredientFacade);
    catalogue.setLoading();

    await firstValueFrom(admin.create(createRequest()), { defaultValue: null });

    expect(catalogue.isLoading()).toBe(true);
    expect(details.requestState(8).status).toBe('idle');
    expect(await firstValueFrom(admin.error$)).toBe('create failed');
    expect(await firstValueFrom(admin.isLoading$)).toBe(false);
  });

  it('discards an in-flight response from before an identity reset', async () => {
    const oldIdentityRequest = new Subject<IngredientAdminDetailDto>();
    const newIdentityRequest = new Subject<IngredientAdminDetailDto>();
    getDetail
      .mockReturnValueOnce(oldIdentityRequest)
      .mockReturnValueOnce(newIdentityRequest);
    const facade = TestBed.inject(IngredientDetailsFacade);
    const store = TestBed.inject(IngredientDetailsStore);

    const oldResult = firstValueFrom(facade.get(9), { defaultValue: null });
    store.reset();
    const newResult = firstValueFrom(facade.get(9));

    oldIdentityRequest.next({ ...detail(9), name: 'Old identity ingredient' });
    oldIdentityRequest.complete();
    expect(await oldResult).toBeNull();
    expect(store.get(9)).toBeNull();

    newIdentityRequest.next({ ...detail(9), name: 'New identity ingredient' });
    newIdentityRequest.complete();
    expect((await newResult).name).toBe('New identity ingredient');
    expect(store.get(9)?.name).toBe('New identity ingredient');
  });
});

function detail(id: number): IngredientAdminDetailDto {
  return {
    id,
    name: `Ingredient ${id}`,
    basis: 100,
    basisUnit: 'g',
    price: null,
    caloriesKcal: 50,
    imageUrl: null,
    proteinG: null,
    fatG: null,
    carbsG: null,
    sugarG: null,
    fiberG: null,
    sodiumMg: null,
    vitaminCMg: null,
    ironMg: null,
  };
}

function createRequest(): IngredientAdminDetailRequest {
  return {
    ...detail(0),
    image: new File(['image'], 'ingredient.avif', { type: 'image/avif' }),
  };
}

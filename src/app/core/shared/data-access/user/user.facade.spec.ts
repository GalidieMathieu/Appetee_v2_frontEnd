import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { UserFacade } from './user.facade';
import { UserStore } from './user.store';
import { UserApi } from './user_auth.api';

describe('UserFacade operation state', () => {
  const checkUserExist = vi.fn();
  const getMe = vi.fn();
  const updateMe = vi.fn();

  beforeEach(() => {
    checkUserExist.mockReset();
    getMe.mockReset();
    updateMe.mockReset();
    TestBed.configureTestingModule({
      providers: [
        UserFacade,
        UserStore,
        {
          provide: UserApi,
          useValue: { getMe, updateMe, checkUserExist },
        },
      ],
    });
  });

  it('stores the claim-scoped current-user response', async () => {
    const profile = { username: 'chef', imageUrl: null };
    getMe.mockReturnValue(of(profile));
    const facade = TestBed.inject(UserFacade);

    expect(await firstValueFrom(facade.getMe$())).toEqual(profile);
    expect(await firstValueFrom(facade.me$)).toEqual(profile);
  });

  it('updates the current profile without accepting an account id', async () => {
    const request = { username: 'new-chef', imageUrl: 'https://example.com/avatar.png' };
    updateMe.mockReturnValue(of(request));
    const facade = TestBed.inject(UserFacade);

    expect(await firstValueFrom(facade.updateMe$(request))).toEqual(request);
    expect(updateMe).toHaveBeenCalledWith(request);
    expect(await firstValueFrom(facade.me$)).toEqual(request);
  });

  it.each([
    [401, 'You are not authorized. Please sign in again.'],
    [404, 'The requested resource was not found.'],
    [400, 'Some information is invalid. Please review your input and try again.'],
  ])('exposes a safe profile error for HTTP %i', async (status, expectedMessage) => {
    getMe.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    const facade = TestBed.inject(UserFacade);

    await expect(firstValueFrom(facade.getMe$())).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(await firstValueFrom(facade.error$)).toBe(expectedMessage);
  });

  it('does not use current-user loading/error state for signup email validation', async () => {
    checkUserExist.mockReturnValue(of({ exists: false }));
    const facade = TestBed.inject(UserFacade);
    const store = TestBed.inject(UserStore);

    expect(await firstValueFrom(facade.checkEmailAndProceed$('new@appetee.dev'))).toEqual({
      status: 'available',
      error: null,
    });
    expect(store.isLoading()).toBe(false);
    expect(store.isLoaded()).toBe(false);
    expect(await firstValueFrom(store.error$)).toBeNull();
  });

  it('returns a flow-owned validation error without changing current-user state', async () => {
    checkUserExist.mockReturnValue(throwError(() => new Error('email check failed')));
    const facade = TestBed.inject(UserFacade);
    const store = TestBed.inject(UserStore);

    expect(await firstValueFrom(facade.checkEmailAndProceed$('new@appetee.dev'))).toEqual({
      status: 'error',
      error: 'email check failed',
    });
    expect(store.isLoading()).toBe(false);
    expect(await firstValueFrom(store.error$)).toBeNull();
  });
});

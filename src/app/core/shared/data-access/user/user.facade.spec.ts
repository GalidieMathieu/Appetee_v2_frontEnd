import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { UserFacade } from './user.facade';
import { UserStore } from './user.store';
import { UserApi } from './user_auth.api';

describe('UserFacade operation state', () => {
  const checkUserExist = vi.fn();

  beforeEach(() => {
    checkUserExist.mockReset();
    TestBed.configureTestingModule({
      providers: [
        UserFacade,
        UserStore,
        {
          provide: UserApi,
          useValue: { getMe: vi.fn(), checkUserExist },
        },
      ],
    });
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

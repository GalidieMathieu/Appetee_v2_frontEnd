import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SESSION_RESETTERS } from '@app/core/session/session-reset.token';
import { AuthApi } from './auth.api';
import { AuthFacade } from './auth.facade';
import { AuthStore } from './auth.store';
import { UserFacade } from '@app/core/shared/data-access/user/user.facade';
import { User } from '@app/core/shared/data-access/user/user.model';
import { UserSession } from './auth.model';

describe('AuthFacade', () => {
  const refreshSessionSpy = vi.fn();
  const getMeSpy = vi.fn();
  const loginSpy = vi.fn();
  const logoutSpy = vi.fn();
  const resetter = { reset: vi.fn() };

  beforeEach(() => {
    refreshSessionSpy.mockReset();
    getMeSpy.mockReset();
    loginSpy.mockReset();
    logoutSpy.mockReset();
    resetter.reset.mockReset();

    TestBed.configureTestingModule({
      providers: [
        AuthFacade,
        AuthStore,
        { provide: SESSION_RESETTERS, useValue: [resetter] },
        {
          provide: AuthApi,
          useValue: {
            refreshSession: refreshSessionSpy,
            login: loginSpy,
            signUp: vi.fn(),
            logout: logoutSpy,
          },
        },
        {
          provide: UserFacade,
          useValue: {
            getMe$: getMeSpy,
          },
        },
      ],
    });
  });

  it('restores a valid cookie-backed session during bootstrap', async () => {
    const session: UserSession = {
      userId: 42,
      username: 'chef',
    };
    const user: User = {
      username: 'chef',
      imageUrl: null,
    };

    const facade = TestBed.inject(AuthFacade);
    const store = TestBed.inject(AuthStore);

    refreshSessionSpy.mockReturnValue(of(session));
    getMeSpy.mockReturnValue(of(user));

    await firstValueFrom(facade.restoreSession$());

    expect(refreshSessionSpy).toHaveBeenCalledTimes(1);
    expect(getMeSpy).toHaveBeenCalledTimes(1);
    expect(store.isAuthenticated()).toBe(true);
    expect(await firstValueFrom(facade.data$)).toEqual(session);
  });

  it('clears user-scoped stores before accepting a different identity', async () => {
    const session: UserSession = { userId: 7, username: 'second-chef' };
    loginSpy.mockReturnValue(of(session));
    getMeSpy.mockReturnValue(of({ username: 'second-chef', imageUrl: null }));

    await firstValueFrom(TestBed.inject(AuthFacade).login$({
      email: 'second@appetee.dev',
      password: 'password',
    }));

    expect(resetter.reset).toHaveBeenCalledTimes(1);
    expect(resetter.reset.mock.invocationCallOrder[0]).toBeLessThan(loginSpy.mock.invocationCallOrder[0]);
  });

  it('clears user-scoped stores when session restoration fails', async () => {
    refreshSessionSpy.mockReturnValue(throwError(() => new Error('no session')));

    await new Promise<void>(resolve => {
      TestBed.inject(AuthFacade).restoreSession$().subscribe({ complete: resolve });
    });

    expect(resetter.reset).toHaveBeenCalledTimes(1);
  });

  it('clears user-scoped stores even when backend logout fails', async () => {
    logoutSpy.mockReturnValue(throwError(() => new Error('offline')));

    await new Promise<void>(resolve => {
      TestBed.inject(AuthFacade).logout().subscribe({ complete: resolve });
    });

    expect(resetter.reset).toHaveBeenCalledTimes(1);
  });
});

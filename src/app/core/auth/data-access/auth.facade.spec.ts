import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
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

  beforeEach(() => {
    refreshSessionSpy.mockReset();
    getMeSpy.mockReset();

    TestBed.configureTestingModule({
      providers: [
        AuthFacade,
        AuthStore,
        { provide: SESSION_RESETTERS, useValue: [] },
        {
          provide: AuthApi,
          useValue: {
            refreshSession: refreshSessionSpy,
            login: vi.fn(),
            signUp: vi.fn(),
            logout: vi.fn(),
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
      id: 42,
      username: 'chef',
      email: 'chef@appetee.dev',
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
});

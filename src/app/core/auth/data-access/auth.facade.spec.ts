import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SESSION_RESETTERS } from '@app/core/session/session-reset.token';
import { AuthApi } from './auth.api';
import { AuthFacade } from './auth.facade';
import { AuthStore } from './auth.store';
import { UserFacade } from '@app/core/shared/data-access/user/user.facade';
import { User } from '@app/core/shared/data-access/user/user.model';
import { UserSession } from './auth.model';
import { SessionExpirationService } from '../session-expiration.service';

describe('AuthFacade', () => {
  const refreshSessionSpy = vi.fn();
  const getMeSpy = vi.fn();
  const loginSpy = vi.fn();
  const requestPasswordRecoverySpy = vi.fn();
  const confirmPasswordRecoverySpy = vi.fn();
  const logoutSpy = vi.fn();
  const resetter = { reset: vi.fn() };
  const sessionExpiration = { clear: vi.fn(), handleExpiration: vi.fn() };

  beforeEach(() => {
    refreshSessionSpy.mockReset();
    getMeSpy.mockReset();
    loginSpy.mockReset();
    requestPasswordRecoverySpy.mockReset();
    confirmPasswordRecoverySpy.mockReset();
    logoutSpy.mockReset();
    resetter.reset.mockReset();
    sessionExpiration.clear.mockReset();
    sessionExpiration.handleExpiration.mockReset();

    TestBed.configureTestingModule({
      providers: [
        AuthFacade,
        AuthStore,
        { provide: SessionExpirationService, useValue: sessionExpiration },
        { provide: SESSION_RESETTERS, useValue: [resetter] },
        {
          provide: AuthApi,
          useValue: {
            refreshSession: refreshSessionSpy,
            login: loginSpy,
            signUp: vi.fn(),
            requestPasswordRecovery: requestPasswordRecoverySpy,
            confirmPasswordRecovery: confirmPasswordRecoverySpy,
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
    expect(sessionExpiration.clear).toHaveBeenCalledTimes(1);
    expect(await firstValueFrom(facade.data$)).toEqual(session);
  });

  it('clears user-scoped stores before accepting a different identity', async () => {
    const session: UserSession = { userId: 7, username: 'second-chef' };
    loginSpy.mockReturnValue(of(session));
    getMeSpy.mockReturnValue(of({ username: 'second-chef', imageUrl: null }));

    await firstValueFrom(TestBed.inject(AuthFacade).login$({
      email: 'second@appetee.dev',
      password: 'password',
      rememberMe: false,
    }));

    expect(resetter.reset).toHaveBeenCalledTimes(1);
    expect(resetter.reset.mock.invocationCallOrder[0]).toBeLessThan(loginSpy.mock.invocationCallOrder[0]);
  });

  it('uses the approved generic message for every invalid-credential response', async () => {
    loginSpy.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 401,
      error: { message: 'No account exists for this email.' },
    })));

    const facade = TestBed.inject(AuthFacade);

    await new Promise<void>(resolve => {
      facade.login$({
        email: 'unknown@appetee.dev',
        password: 'incorrect',
        rememberMe: false,
      }).subscribe({ complete: resolve });
    });

    expect(await firstValueFrom(facade.error$)).toBe('Invalid email or password.');
  });

  it('uses the approved retry-later message for throttled login attempts', async () => {
    loginSpy.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 })));

    const facade = TestBed.inject(AuthFacade);

    await new Promise<void>(resolve => {
      facade.login$({
        email: 'chef@appetee.dev',
        password: 'password',
        rememberMe: true,
      }).subscribe({ complete: resolve });
    });

    expect(await firstValueFrom(facade.error$)).toBe(
      'Too many login attempts. Please try again later.'
    );
  });

  it('owns password recovery request loading and forwards the core API contract', async () => {
    requestPasswordRecoverySpy.mockReturnValue(of(void 0));
    const facade = TestBed.inject(AuthFacade);
    const request = { email: 'chef@appetee.dev' };

    await firstValueFrom(facade.requestPasswordRecovery$(request));

    expect(requestPasswordRecoverySpy).toHaveBeenCalledWith(request);
    expect(facade.isPasswordRecoveryLoading()).toBe(false);
    expect(facade.passwordRecoveryError()).toBeNull();
  });

  it('maps recovery request failures without exposing backend account details', async () => {
    requestPasswordRecoverySpy.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 404,
      error: { detail: 'No user has that email.' },
    })));
    const facade = TestBed.inject(AuthFacade);

    await new Promise<void>(resolve => {
      facade.requestPasswordRecovery$({ email: 'unknown@appetee.dev' })
        .subscribe({ complete: resolve });
    });

    expect(facade.passwordRecoveryError()).toBe(
      'We could not send password reset instructions. Please try again.'
    );
    expect(facade.isPasswordRecoveryLoading()).toBe(false);
  });

  it('maps invalid, expired, and used reset tokens to one safe facade error', async () => {
    confirmPasswordRecoverySpy.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 410,
      error: { code: 'password_reset_token_used', detail: 'Already consumed.' },
    })));
    const facade = TestBed.inject(AuthFacade);

    await new Promise<void>(resolve => {
      facade.confirmPasswordRecovery$({ token: 'used-token', newPassword: 'new-password' })
        .subscribe({ complete: resolve });
    });

    expect(facade.passwordRecoveryError()).toBe(
      'This password reset link is invalid or has expired. Request a new link.'
    );
  });

  it('prevents duplicate password recovery operations while one is pending', () => {
    const pending = new Subject<void>();
    requestPasswordRecoverySpy.mockReturnValue(pending);
    const facade = TestBed.inject(AuthFacade);

    facade.requestPasswordRecovery$({ email: 'chef@appetee.dev' }).subscribe();
    facade.requestPasswordRecovery$({ email: 'chef@appetee.dev' }).subscribe();

    expect(requestPasswordRecoverySpy).toHaveBeenCalledTimes(1);
    expect(facade.isPasswordRecoveryLoading()).toBe(true);

    pending.next();
    pending.complete();
    expect(facade.isPasswordRecoveryLoading()).toBe(false);
  });

  it('clears user-scoped stores when session restoration fails', async () => {
    refreshSessionSpy.mockReturnValue(throwError(() => new Error('no session')));

    await new Promise<void>(resolve => {
      TestBed.inject(AuthFacade).restoreSession$().subscribe({ complete: resolve });
    });

    expect(resetter.reset).toHaveBeenCalledTimes(1);
    expect(sessionExpiration.handleExpiration).not.toHaveBeenCalled();
  });

  it('preserves the expiration reason when restoration finds an expired cookie', async () => {
    refreshSessionSpy.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 401,
      error: { code: 'session_expired' },
    })));

    await new Promise<void>(resolve => {
      TestBed.inject(AuthFacade).restoreSession$().subscribe({ complete: resolve });
    });

    expect(sessionExpiration.handleExpiration).toHaveBeenCalledTimes(1);
    expect(resetter.reset).not.toHaveBeenCalled();
  });

  it('clears user-scoped stores even when backend logout fails', async () => {
    logoutSpy.mockReturnValue(throwError(() => new Error('offline')));

    await new Promise<void>(resolve => {
      TestBed.inject(AuthFacade).logout().subscribe({ complete: resolve });
    });

    expect(resetter.reset).toHaveBeenCalledTimes(1);
    expect(sessionExpiration.clear).toHaveBeenCalledTimes(1);
  });
});

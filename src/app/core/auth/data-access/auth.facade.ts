import { HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { AbstractLoadFacade } from '@app/core/shared/data-access/generic-template/abstractLoadFacade';
import { catchError, EMPTY, finalize, map, Observable, of, switchMap, take, tap } from 'rxjs';
import {
  LoginRequest,
  PasswordRecoveryConfirmRequest,
  PasswordRecoveryRequest,
  SignUpRequest,
  UserSession,
} from './auth.model';
import { AuthApi } from './auth.api';
import { AuthStore } from './auth.store';
import { UserFacade } from '@app/core/shared/data-access/user/user.facade';
import { SessionService } from '@app/core/session/session.service';
import { SessionExpirationService } from '../session-expiration.service';
import {
  toPasswordRecoveryConfirmMessage,
  toPasswordRecoveryRequestMessage,
} from './password-recovery-error-message';

@Injectable({ providedIn: 'root' })
export class AuthFacade extends AbstractLoadFacade<UserSession | null, AuthStore> {
  /**
   * Creates a new AuthFacade.
   *
   * @param api API client for authentication endpoints.
   * @param store Store managing authentication state (session, load state, errors).
   * @param userFacade Facade responsible for fetching and storing the current user profile.
   */
  constructor(
    private readonly api: AuthApi,
    store: AuthStore,
    private readonly userFacade: UserFacade
  ) {
    super(store);
  }

  private readonly session = inject(SessionService);
  private readonly sessionExpiration = inject(SessionExpirationService);
  private readonly document = inject(DOCUMENT);
  private readonly passwordRecoveryLoadingState = signal(false);
  private readonly passwordRecoveryErrorState = signal<string | null>(null);

  readonly isPasswordRecoveryLoading = this.passwordRecoveryLoadingState.asReadonly();
  readonly passwordRecoveryError = this.passwordRecoveryErrorState.asReadonly();

  private setAuthenticatedSession(session: UserSession): void {
    this.sessionExpiration.clear();
    this.setSuccess(session);
    this.store.isAuthenticated.set(true);
  }

  /**
   * Validates the current authenticated user profile and only then persists the session data.
   *
   * @remarks This keeps cookie restoration and explicit sign-in flows aligned.
   */
  private hydrateSession$(session: UserSession): Observable<void> {
    return this.userFacade.getMe$().pipe(
      tap(() => this.setAuthenticatedSession(session)),
      map(() => void 0)
    );
  }

  /**
   * Restores a cookie-backed session during bootstrap so authenticated users do not need to log in again.
   */
  restoreSession$(): Observable<void> {
    if (this.isLoaded()) {
      return of(void 0);
    }

    this.setLoading();

    return this.api.refreshSession().pipe(
      switchMap((session: UserSession) => this.hydrateSession$(session)),
      catchError(error => {
        if (this.isExpiredSessionResponse(error)) {
          if (this.isPasswordRecoveryLocation()) {
            this.session.resetAll();
            this.sessionExpiration.clear();
          } else {
            this.sessionExpiration.handleExpiration();
          }
        } else {
          this.session.resetAll();
        }
        return EMPTY;
      })
    );
  }

  /**
   * Authenticates a user using username/password credentials.
   *
   * @param username User login name.
   * @param password Plain text password.
   * @returns Observable that completes when login succeeds; emits no value.
   */
  login$(request: LoginRequest): Observable<void> {
    if(this.store.isLoading()) {
      return EMPTY;
    }

    // A new authentication attempt is an identity boundary. Clear all data owned by
    // the previous identity before accepting profile/session data for the next one.
    this.session.resetAll();
    this.setLoading();

    return this.api.login(request).pipe(
      switchMap((session: UserSession) => this.hydrateSession$(session)),
      catchError(err => {
        this.store.setError(this.toLoginMessage(err));
        return EMPTY;
      })
    );
  }

  private toLoginMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        return 'Invalid email or password.';
      }

      if (error.status === 429) {
        return 'Too many login attempts. Please try again later.';
      }
    }

    return this.toUserMessage(error);
  }

  private isExpiredSessionResponse(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
      return false;
    }

    const payload = error.error;
    return !!payload
      && typeof payload === 'object'
      && (payload as Record<string, unknown>)['code'] === 'session_expired';
  }

  private isPasswordRecoveryLocation(): boolean {
    const path = this.document.location?.pathname;
    return path === '/auth/forgot-password' || path === '/auth/reset-password';
  }

  /**
   * Creates a new user account and establishes an authenticated session.
   *
   * @param user The user payload required by the sign-up endpoint.
   * @returns Observable that completes when sign-up succeeds; emits no value.
   *
   * @remarks
   * - On success, stores the returned session and then fetches the current user profile via `userFacade.getMe$()`.
   * - On error, maps the error to a user-facing message and completes without emitting.
   */
  signUp(user: SignUpRequest): Observable<void> {
    if(this.store.isLoading()) {
      return EMPTY;
    }
    this.session.resetAll();
    this.setLoading();

    return this.api.signUp(user).pipe(
      switchMap((session: UserSession) => this.hydrateSession$(session)),
      catchError(err => {
        this.store.setError(this.toUserMessage(err));
        return EMPTY;
      })
    );
  }

  requestPasswordRecovery$(request: PasswordRecoveryRequest): Observable<void> {
    if (this.passwordRecoveryLoadingState()) {
      return EMPTY;
    }

    this.passwordRecoveryErrorState.set(null);
    this.passwordRecoveryLoadingState.set(true);

    return this.api.requestPasswordRecovery(request).pipe(
      take(1),
      catchError(error => {
        this.passwordRecoveryErrorState.set(toPasswordRecoveryRequestMessage(error));
        return EMPTY;
      }),
      finalize(() => this.passwordRecoveryLoadingState.set(false))
    );
  }

  confirmPasswordRecovery$(request: PasswordRecoveryConfirmRequest): Observable<void> {
    if (this.passwordRecoveryLoadingState()) {
      return EMPTY;
    }

    this.passwordRecoveryErrorState.set(null);
    this.passwordRecoveryLoadingState.set(true);

    return this.api.confirmPasswordRecovery(request).pipe(
      take(1),
      catchError(error => {
        this.passwordRecoveryErrorState.set(toPasswordRecoveryConfirmMessage(error));
        return EMPTY;
      }),
      finalize(() => this.passwordRecoveryLoadingState.set(false))
    );
  }

  clearPasswordRecoveryError(): void {
    this.passwordRecoveryErrorState.set(null);
  }



  /**
   * Logout: call backend to revoke cookie, then wipe all client-side stores.
   */
  logout(): Observable<void> {

    return this.api.logout().pipe(
      catchError(err => {
        // optional: record/log, but don't block local cleanup
        this.store.setError(this.toUserMessage(err));
        return EMPTY;
      }),
      finalize(() =>{
        this.session.resetAll();
        this.sessionExpiration.clear();
        this.store.notifyLoggedOut();
      }),
      map(() => void 0)
    );
  }


}

import { inject, Injectable } from '@angular/core';
import { AbstractLoadFacade } from '@app/core/shared/data-access/generic-template/abstractLoadFacade';
import { catchError, EMPTY, finalize, map, Observable, switchMap, tap } from 'rxjs';
import { LoginRequest, SignUpRequest, UserSession } from './auth.model';
import { AuthApi } from './auth.api';
import { AuthStore } from './auth.store';
import { UserFacade } from '@app/core/shared/data-access/user/user.facade';
import { SessionService } from '@app/core/session/session.service';

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

  /**
   * Indicates whether authentication/session data has been successfully loaded.
   *
   * @returns True if the auth store is in a loaded state; otherwise false.
   */
  protected isLoaded(): boolean { return this.store.isLoaded(); }

  /**
   * Transitions the auth store into a "loading" state and clears prior errors.
   *
   * @returns void
   */
  protected setLoading(): void { this.store.setLoading(); }

  /**
   * Records an error state and user-facing message in the auth store.
   *
   * @param message A user-facing error message to display in the UI.
   * @returns void
   */
  protected setError(message: string): void { this.store.setError(message); }

  /**
   * Records a successful authentication/session result in the auth store.
   *
   * @param data The UserSession payload returned by the authentication API.
   * @returns void
   */
  protected setSuccess(data: UserSession): void { this.store.setSuccess(data); }

  /**
   * Resets authentication state to its initial values.
   *
   * @returns void
   */
  protected override reset(): void { this.store.reset(); }

  /**
   * Authenticates a user using username/password credentials.
   *
   * @param username User login name.
   * @param password Plain text password.
   * @returns Observable that completes when login succeeds; emits no value.
   *
   * @remarks
   * - The login endpoint typically establishes an authenticated session (often via HTTPS-only cookie).
   * - On success, updates auth store session state, sets `isAuthenticated`, then fetches the current user profile via `userFacade.getMe$()`.
   * - On error, maps the error to a user-facing message and completes without emitting.
   */
  login$(request: LoginRequest): Observable<void> {
    if(this.store.isLoading()) {
      return EMPTY;
    }

    this.setLoading();

    return this.api.login(request).pipe(
      tap((session: UserSession) => {
        this.setSuccess(session);
        this.store.isAuthenticated.set(true);
      }),
      switchMap(() => this.userFacade.getMe$()),
      map(() => void 0),
      catchError(err => {
        this.store.setError(this.toUserMessage(err));
        return EMPTY;
      })
    );
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
    this.setLoading();
    console.log(user);

    return this.api.signUp(user).pipe(
      tap((session: UserSession) => {
        this.setSuccess(session);
        console.log(session);
      }),
      switchMap(() => this.userFacade.getMe$()),
      map(() => void 0),
      catchError(err => {
        this.store.setError(this.toUserMessage(err));
        return EMPTY;
      })
    );
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
        this.store.notifyLoggedOut();
      }),
      map(() => void 0)
    );
  }


}
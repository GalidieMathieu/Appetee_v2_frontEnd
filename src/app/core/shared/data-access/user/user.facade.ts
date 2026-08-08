import { Injectable } from '@angular/core';

import { AbstractLoadFacade } from '../generic-template/abstractLoadFacade';
import { UserApi } from './user_auth.api';
import { UpdateCurrentUserRequest, User } from './user.model';
import { UserStore } from './user.store';
import { catchError, distinctUntilChanged, map, Observable, of, take, tap, throwError } from 'rxjs';
import { toApiErrorMessage } from '../generic-template/api-error-message';

export interface EmailAvailabilityResult {
  readonly status: 'available' | 'taken' | 'error';
  readonly error: string | null;
}


@Injectable({ providedIn: 'root' })
export class UserFacade extends AbstractLoadFacade<User | null, UserStore> {

  constructor(
    private readonly api: UserApi,
    store: UserStore
  ) {
    super(store);
  }

    // alias for readability
    readonly me$ = this.data$;

    readonly username$ = this.me$.pipe(
      map(me => me?.username ?? ''),
      distinctUntilChanged()
    );

  //Function for UserData manipulation : 

    /**
   * Gets the current user based on the cookies.
   * @warning Caller must handle errors (use catchError or provide an error callback).
   */
  getMe$() : Observable<User> {
    this.store.setLoading();
    return this.api.getMe().pipe(
      tap((data : User) => this.setSuccess(data)),
      catchError((error: unknown) => {
        this.setError(this.toUserMessage(error));
        return throwError(() => error);
      })
    );
  }

  updateMe$(request: UpdateCurrentUserRequest): Observable<User> {
    this.store.setLoading();
    return this.api.updateMe(request).pipe(
      tap((data: User) => this.setSuccess(data)),
      catchError((error: unknown) => {
        this.setError(this.toUserMessage(error));
        return throwError(() => error);
      })
    );
  }

  /*
    Check the current email, need to be subscribe to handle data
  */
  checkEmailAndProceed$(email: string): Observable<EmailAvailabilityResult>
  {
    return this.api.checkUserExist(email).pipe(
      take(1),
      map(res => ({
        status: res.exists ? 'taken' as const : 'available' as const,
        error: null,
      })),
      catchError((error: unknown) => of({
        status: 'error' as const,
        error: toApiErrorMessage(error),
      }))
    );

  }

}

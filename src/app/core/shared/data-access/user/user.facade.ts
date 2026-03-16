import { Injectable } from '@angular/core';

import { AbstractLoadFacade } from '../generic-template/abstractLoadFacade';
import { UserApi } from './user_auth.api';
import { User } from './user.model';
import { UserStore } from './user.store';
import { catchError, distinctUntilChanged, EMPTY, map, Observable, of, take, tap } from 'rxjs';
import { EntityStore } from '../generic-template/entityStore';


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
      tap((data : User) => this.setSuccess(data))
    );
  }

  /*
    Check the current email, need to be subscribe to handle data
  */
  checkEmailAndProceed$(email: string): Observable<boolean> 
  {
    this.store.setLoading();
    return this.api.checkUserExist(email).pipe(
      take(1),
      map(res => {
        this.store.setSucessWithoutData();
        return !res.exists;
      }),
      catchError(err => {
        this.store.setError(this.toUserMessage(err));
        return of(false);
      })
    );

  }

}

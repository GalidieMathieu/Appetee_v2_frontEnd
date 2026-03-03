import { Injectable, signal } from '@angular/core';
import { UserSession } from './auth.model';
import { EntityStore } from '@app/core/shared/data-access/generic-template/entityStore';
import { Observable, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthStore extends EntityStore<UserSession | null> {
  constructor() {
    super(null);
  }

  // Logout event (for takeUntil)
  private readonly loggedOutSubject = new Subject<void>();
  readonly loggedOut$: Observable<void> = this.loggedOutSubject.asObservable();

  //for all auth related
  readonly isAuthenticated = signal(false);

  protected initialValue(): UserSession | null {
    return null;
  }

  override reset(): void {
    super.reset();
    this.isAuthenticated.set(false);
  }
  
  notifyLoggedOut(): void {
    this.loggedOutSubject.next();
  }

}
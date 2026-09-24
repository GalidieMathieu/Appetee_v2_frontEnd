/** Finalizes a confirmed account closure at the browser identity boundary and carries one success notice. */
import { Injectable, inject } from '@angular/core';
import { AuthStore } from './data-access/auth.store';
import { SessionExpirationService } from './session-expiration.service';
import { SessionService } from '../session/session.service';

export const ACCOUNT_CLOSED_MESSAGE = 'Your account has been deleted and you have been signed out.';

@Injectable({ providedIn: 'root' })
export class AccountClosureService {
  private readonly session = inject(SessionService);
  private readonly authStore = inject(AuthStore);
  private readonly sessionExpiration = inject(SessionExpirationService);
  private pendingMessage: string | null = null;

  /** Clears all identity-scoped state only after the account API reports successful closure. */
  complete(): void {
    this.session.resetAll();
    this.sessionExpiration.clear();
    this.authStore.notifyLoggedOut();
    this.pendingMessage = ACCOUNT_CLOSED_MESSAGE;
  }

  consumeMessage(): string | null {
    const message = this.pendingMessage;
    this.pendingMessage = null;
    return message;
  }
}

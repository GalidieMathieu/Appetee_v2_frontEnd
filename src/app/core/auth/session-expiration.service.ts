import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '@app/core/session/session.service';

export const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please log in again.';

@Injectable({ providedIn: 'root' })
export class SessionExpirationService {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private expirationHandled = false;
  private pendingMessage: string | null = null;

  handleExpiration(): void {
    if (this.expirationHandled) {
      return;
    }

    this.expirationHandled = true;
    this.pendingMessage = SESSION_EXPIRED_MESSAGE;
    this.session.resetAll();

    if (!this.router.url.startsWith('/auth/login')) {
      void this.router.navigateByUrl('/auth/login');
    }
  }

  consumeMessage(): string | null {
    const message = this.pendingMessage;
    this.pendingMessage = null;
    return message;
  }

  clear(): void {
    this.expirationHandled = false;
    this.pendingMessage = null;
  }
}

/** Verifies successful closure clears every local identity boundary and exposes its notice once. */
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthStore } from './data-access/auth.store';
import { AccountClosureService, ACCOUNT_CLOSED_MESSAGE } from './account-closure.service';
import { SessionExpirationService } from './session-expiration.service';
import { SessionService } from '../session/session.service';

describe('AccountClosureService', () => {
  it('clears scoped state, ends logout-sensitive streams, and consumes its notice once', () => {
    const resetAll = vi.fn();
    const notifyLoggedOut = vi.fn();
    const clearExpiration = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        AccountClosureService,
        { provide: SessionService, useValue: { resetAll } },
        { provide: AuthStore, useValue: { notifyLoggedOut } },
        { provide: SessionExpirationService, useValue: { clear: clearExpiration } },
      ],
    });

    const service = TestBed.inject(AccountClosureService);
    service.complete();

    expect(resetAll).toHaveBeenCalledOnce();
    expect(clearExpiration).toHaveBeenCalledOnce();
    expect(notifyLoggedOut).toHaveBeenCalledOnce();
    expect(service.consumeMessage()).toBe(ACCOUNT_CLOSED_MESSAGE);
    expect(service.consumeMessage()).toBeNull();
  });
});

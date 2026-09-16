import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { SessionService } from '@app/core/session/session.service';
import { SESSION_EXPIRED_MESSAGE, SessionExpirationService } from './session-expiration.service';

describe('SessionExpirationService', () => {
  const resetAll = vi.fn();
  const navigateByUrl = vi.fn(() => Promise.resolve(true));
  const router = { url: '/profile', navigateByUrl };

  beforeEach(() => {
    resetAll.mockReset();
    navigateByUrl.mockClear();
    router.url = '/profile';

    TestBed.configureTestingModule({
      providers: [
        SessionExpirationService,
        { provide: SessionService, useValue: { resetAll } },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('resets scoped state, redirects, and exposes the expiration message once', () => {
    const service = TestBed.inject(SessionExpirationService);

    service.handleExpiration();

    expect(resetAll).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/login');
    expect(service.consumeMessage()).toBe(SESSION_EXPIRED_MESSAGE);
    expect(service.consumeMessage()).toBeNull();
  });

  it('handles concurrent unauthorized responses only once', () => {
    const service = TestBed.inject(SessionExpirationService);

    service.handleExpiration();
    service.handleExpiration();

    expect(resetAll).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledTimes(1);
  });

  it('can handle a future expiration after a new authenticated session', () => {
    const service = TestBed.inject(SessionExpirationService);

    service.handleExpiration();
    service.clear();
    router.url = '/home';
    service.handleExpiration();

    expect(resetAll).toHaveBeenCalledTimes(2);
    expect(navigateByUrl).toHaveBeenCalledTimes(2);
  });
});

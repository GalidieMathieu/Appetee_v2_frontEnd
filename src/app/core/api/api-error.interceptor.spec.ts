import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SKIP_AUTO_LOGOUT } from '../auth/data-access/auth.request-context';
import { SessionExpirationService } from '../auth/session-expiration.service';
import { apiErrorInterceptor } from './api-error.interceptor';

describe('apiErrorInterceptor', () => {
  let httpClient: HttpClient;
  let http: HttpTestingController;
  const handleExpiration = vi.fn();

  beforeEach(() => {
    handleExpiration.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: SessionExpirationService, useValue: { handleExpiration } },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('expires the local session after an unauthorized protected request', () => {
    httpClient.get('/api/users/me').subscribe({ error: () => undefined });

    http.expectOne('/api/users/me').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(handleExpiration).toHaveBeenCalledTimes(1);
  });

  it('leaves expected authentication endpoint failures to their facade', () => {
    const context = new HttpContext().set(SKIP_AUTO_LOGOUT, true);
    httpClient.get('/api/auth/session', { context }).subscribe({ error: () => undefined });

    http.expectOne('/api/auth/session').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(handleExpiration).not.toHaveBeenCalled();
  });
});

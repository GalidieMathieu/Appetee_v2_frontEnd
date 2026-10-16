import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';

import { API_URL } from '../api/api.config';
import { authInterceptor } from './auth.interceptor';
import { CsrfTokenService } from './csrf-token.service';

const API = 'https://api.appetee.test/api';
const CSRF = `${API}/auth/csrf`;

describe('CsrfTokenService', () => {
  let service: CsrfTokenService;
  let http: HttpTestingController;
  let client: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: API_URL, useValue: API },
    ] });
    service = TestBed.inject(CsrfTokenService);
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
  });

  afterEach(() => { vi.useRealTimers(); http.verify({ ignoreCancelled: true }); });

  it('shares and caches a validated lease only in the current service instance', async () => {
    const first = firstValueFrom(service.acquire());
    const second = firstValueFrom(service.acquire());
    http.expectOne(CSRF).flush({ requestToken: 'token', headerName: 'X-CSRF-TOKEN' });
    expect(await first).toEqual(await second);
    expect(await firstValueFrom(service.acquire())).toEqual(await first);
    http.expectNone(CSRF);
  });

  it.each([{}, null, { requestToken: '', headerName: 'X-CSRF-TOKEN' },
    { requestToken: 'token', headerName: 'Authorization' },
    { requestToken: 42, headerName: 'X-CSRF-TOKEN' }])
    ('fails closed on malformed bootstrap contracts: %j', async body => {
      const result = firstValueFrom(client.post(`${API}/mutation`, {}));
      const rejection = expect(result).rejects.toThrow('security handshake failed');
      http.expectOne(CSRF).flush(body);
      await rejection;
      http.expectNone(`${API}/mutation`);
      client.post(`${API}/mutation`, {}).subscribe();
      http.expectOne(CSRF).flush({ requestToken: 'valid', headerName: 'X-CSRF-TOKEN' });
      http.expectOne(`${API}/mutation`).flush(null);
    });

  it('does not send the mutation when bootstrap fails and does not automatically retry', () => {
    let error: unknown;
    client.post(`${API}/mutation`, {}).subscribe({ error: value => { error = value; } });
    http.expectOne(CSRF).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(error).toBeTruthy();
    http.expectNone(`${API}/mutation`);
    http.expectNone(CSRF);
  });

  it('bounds handshake waits using the existing ten-second Core read policy', async () => {
    vi.useFakeTimers();
    const result = firstValueFrom(client.post(`${API}/mutation`, {}));
    const rejection = expect(result).rejects.toThrow();
    const bootstrap = http.expectOne(CSRF);
    await vi.advanceTimersByTimeAsync(10001);
    await rejection;
    expect(bootstrap.cancelled).toBe(true);
    http.expectNone(`${API}/mutation`);
    http.expectNone(CSRF);
  });

  it('invalidates old leases and ensures a failed eager refresh cannot restore one', async () => {
    const pending = firstValueFrom(service.acquire());
    http.expectOne(CSRF).flush({ requestToken: 'old', headerName: 'X-CSRF-TOKEN' });
    const old = await pending;
    service.reset();
    expect(service.isCurrent(old)).toBe(false);
    http.expectOne(CSRF).error(new ProgressEvent('error'));
    service.reject(old);
    http.expectNone(CSRF);
    const next = firstValueFrom(service.acquire());
    http.expectOne(CSRF).flush({ requestToken: 'new', headerName: 'X-CSRF-TOKEN' });
    expect((await next).requestToken).toBe('new');
  });
});

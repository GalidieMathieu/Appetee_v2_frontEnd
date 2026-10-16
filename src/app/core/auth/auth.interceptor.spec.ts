import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';

import { API_URL } from '../api/api.config';
import { apiErrorInterceptor } from '../api/api-error.interceptor';
import { SessionService } from '../session/session.service';
import { SESSION_RESETTERS } from '../session/session-reset.token';
import { AuthApi } from './data-access/auth.api';
import { CsrfTokenService } from './csrf-token.service';
import { authInterceptor } from './auth.interceptor';
import { SessionExpirationService } from './session-expiration.service';
import { MealPlanContextStore } from '../shared/data-access/meal-plan/meal-plan-context.store';
import { MealPlanMutationCoordinator } from '../shared/data-access/meal-plan/meal-plan-mutation-coordinator';
import { NutritionProfileDto } from '../shared/data-access/user/nutrition-profile.model';
import { AuthFacade } from './data-access/auth.facade';
import { AuthStore } from './data-access/auth.store';
import { CapabilitiesStore } from './data-access/capabilities.store';
import { UserFacade } from '../shared/data-access/user/user.facade';

const API = 'https://api.appetee.test/api';
const CSRF = `${API}/auth/csrf`;

describe('authInterceptor CSRF integration', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let csrf: CsrfTokenService;
  const handleExpiration = vi.fn();

  beforeEach(() => {
    handleExpiration.mockReset();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: API_URL, useValue: API },
      { provide: SessionExpirationService, useValue: { handleExpiration, clear: vi.fn() } },
      { provide: SESSION_RESETTERS, useExisting: CsrfTokenService, multi: true },
      { provide: SESSION_RESETTERS, useExisting: AuthStore, multi: true },
      { provide: SESSION_RESETTERS, useExisting: CapabilitiesStore, multi: true },
      { provide: UserFacade, useValue: { getMe$: () => of({ username: 'chef', imageUrl: null }) } },
    ] });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    csrf = TestBed.inject(CsrfTokenService);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('bootstraps anonymous login with credentials and rotates after success without replay', () => {
    TestBed.inject(AuthApi).login({ email: 'chef@appetee.test', password: 'test', rememberMe: false }).subscribe();
    http.expectNone(`${API}/auth/login`);
    bootstrap('anonymous-token');
    const login = http.expectOne(`${API}/auth/login`);
    expect(login.request.withCredentials).toBe(true);
    expect(login.request.headers.get('X-CSRF-TOKEN')).toBe('anonymous-token');
    expect(login.request.headers.has('Origin')).toBe(false);
    login.flush({ userId: 1, username: 'chef' });
    bootstrap('signed-in-token');
    client.put(`${API}/recipes/1/favorite`, null).subscribe();
    const mutation = http.expectOne(`${API}/recipes/1/favorite`);
    expect(mutation.request.headers.get('X-CSRF-TOKEN')).toBe('signed-in-token');
    mutation.flush(null);
    http.expectNone(`${API}/auth/login`);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('protects %s with a shared in-memory token', method => {
    client.request(method, `${API}/resource`, { body: { value: 1 } }).subscribe();
    bootstrap('request-token');
    const request = http.expectOne(`${API}/resource`);
    expect(request.request.headers.getAll('X-CSRF-TOKEN')).toEqual(['request-token']);
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({ value: 1 });
    request.flush(null);
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])('adds credentials but no token/handshake to safe %s', method => {
    client.request(method, `${API}/recipes`).subscribe();
    const request = http.expectOne(`${API}/recipes`);
    expect(request.request.headers.has('X-CSRF-TOKEN')).toBe(false);
    expect(request.request.withCredentials).toBe(true);
    request.flush(null);
    http.expectNone(CSRF);
  });

  it.each([
    'https://api.appetee.test.evil.test/api/resource',
    'https://api.appetee.test:444/api/resource',
    'http://api.appetee.test/api/resource',
    'https://evil.test/api/resource',
    'https://api.appetee.test/api-other/resource',
    'https://api.appetee.test/apix',
    'https://api.appetee.test/api%2Fresource',
    'https://api.appetee.test/api/../outside',
    'https://api.appetee.test/outside',
    'https://user:secret@api.appetee.test/api/resource',
    '/api/resource',
  ])('does not attach API credentials or tokens outside the exact origin/path: %s', url => {
    csrf.acquire().subscribe();
    bootstrap('already-cached-secret');
    client.post(url, {}).subscribe();
    const request = http.expectOne(url);
    expect(request.request.headers.has('X-CSRF-TOKEN')).toBe(false);
    expect(request.request.withCredentials).toBe(false);
    request.flush(null);
    http.expectNone(CSRF);
  });

  it.each([`${API}`, `${API}/`, 'https://API.APPETEE.TEST:443/api/resource?query=1'])
    ('accepts the exact boundary and URL-equivalent API origins: %s', url => {
      client.post(url, {}).subscribe();
      bootstrap('token');
      const request = http.expectOne(url);
      expect(request.request.headers.get('X-CSRF-TOKEN')).toBe('token');
      request.flush(null);
    });

  it('shares concurrent anonymous bootstraps and never recursively bootstraps the safe handshake', () => {
    client.post(`${API}/auth/password-recovery/request`, {}).subscribe();
    client.patch(`${API}/recipes/1`, {}).subscribe();
    bootstrap('shared-token');
    for (const url of [`${API}/auth/password-recovery/request`, `${API}/recipes/1`]) {
      const request = http.expectOne(url);
      expect(request.request.headers.get('X-CSRF-TOKEN')).toBe('shared-token');
      request.flush(null);
    }
    http.expectNone(CSRF);
  });

  it('preserves FormData, credentials and browser-owned multipart boundaries', () => {
    const body = new FormData();
    body.append('file', new Blob(['image'], { type: 'image/png' }), 'recipe.png');
    client.post(`${API}/uploads`, body).subscribe();
    bootstrap('upload-token');
    const upload = http.expectOne(`${API}/uploads`);
    expect(upload.request.body).toBe(body);
    expect(upload.request.withCredentials).toBe(true);
    expect(upload.request.headers.has('Content-Type')).toBe(false);
    expect(upload.request.headers.get('X-CSRF-TOKEN')).toBe('upload-token');
    upload.flush({ url: 'https://images.test/recipe.png' });
  });

  it.each([
    ['POST', '/auth/sign-up'], ['POST', '/auth/logout'],
    ['GET', '/auth/session'], ['DELETE', '/users/me'],
    ['PUT', '/users/me'], ['POST', '/auth/password-recovery/confirm'],
  ])('rotates token state after a successful %s %s identity boundary', (method, path) => {
    csrf.acquire().subscribe();
    bootstrap('before');
    client.request(method, `${API}${path}`).subscribe();
    const response = http.expectOne(`${API}${path}`);
    response.flush(method === 'GET' ? { userId: 1, username: 'chef' } : null);
    bootstrap('after');
    client.post(`${API}/mutation`, {}).subscribe();
    const mutation = http.expectOne(`${API}/mutation`);
    expect(mutation.request.headers.get('X-CSRF-TOKEN')).toBe('after');
    mutation.flush(null);
  });

  it('joins session/account resetters and cancels a previous identity bootstrap and waiting mutation', async () => {
    const result = firstValueFrom(client.post(`${API}/mutation`, {}));
    const rejection = expect(result).rejects.toThrow('session changed');
    const old = http.expectOne(CSRF);
    TestBed.inject(SessionService).resetAll();
    expect(old.cancelled).toBe(true);
    await rejection;
    http.expectNone(`${API}/mutation`);
    bootstrap('new-identity');
    client.post(`${API}/mutation`, {}).subscribe();
    const request = http.expectOne(`${API}/mutation`);
    expect(request.request.headers.get('X-CSRF-TOKEN')).toBe('new-identity');
    request.flush(null);
  });

  it('refreshes on confirmed csrf_invalid but returns the original error without mutation replay', () => {
    let error: unknown;
    client.put(`${API}/mutation`, {}, { headers: { 'X-Meal-Plan-Revision': '8' } })
      .subscribe({ error: value => { error = value; } });
    bootstrap('expired');
    const mutation = http.expectOne(`${API}/mutation`);
    mutation.flush({ code: 'csrf_invalid', traceId: 'test-trace' }, { status: 400, statusText: 'Bad Request' });
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect((error as HttpErrorResponse).error.code).toBe('csrf_invalid');
    expect(mutation.request.headers.get('X-Meal-Plan-Revision')).toBe('8');
    expect(handleExpiration).not.toHaveBeenCalled();
    bootstrap('fresh');
    http.expectNone(`${API}/mutation`);
  });

  it('does not let a late old-identity csrf_invalid invalidate the new token', () => {
    client.post(`${API}/old`, {}).subscribe({ error: () => undefined });
    bootstrap('old');
    const old = http.expectOne(`${API}/old`);
    csrf.reset();
    bootstrap('new');
    old.flush({ code: 'csrf_invalid' }, { status: 400, statusText: 'Bad Request' });
    http.expectNone(CSRF);
    client.post(`${API}/new`, {}).subscribe();
    const request = http.expectOne(`${API}/new`);
    expect(request.request.headers.get('X-CSRF-TOKEN')).toBe('new');
    request.flush(null);
  });

  it.each([0, 400, 403, 500])('does not refresh/replay ordinary mutation failures (%s)', status => {
    client.post(`${API}/mutation`, {}).subscribe({ error: () => undefined });
    bootstrap('token');
    const request = http.expectOne(`${API}/mutation`);
    if (status === 0) request.error(new ProgressEvent('error'));
    else request.flush({ code: 'other_error' }, { status, statusText: 'Failed' });
    http.expectNone(CSRF);
    http.expectNone(`${API}/mutation`);
  });

  it('preserves protected 401 expiry and expected anonymous authentication failure handling', () => {
    handleExpiration.mockImplementation(() => TestBed.inject(SessionService).resetAll());
    client.get(`${API}/users/me`).subscribe({ error: () => undefined });
    http.expectOne(`${API}/users/me`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(handleExpiration).toHaveBeenCalledTimes(1);
    bootstrap('anonymous');
    TestBed.inject(AuthApi).login({ email: 'unknown@test.dev', password: 'wrong', rememberMe: false })
      .subscribe({ error: () => undefined });
    http.expectOne(`${API}/auth/login`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(handleExpiration).toHaveBeenCalledTimes(1);
    http.expectNone(CSRF);
  });

  it('preserves real facade login/restoration and refetches through logout cleanup', () => {
    const facade = TestBed.inject(AuthFacade);
    const store = TestBed.inject(AuthStore);
    facade.login$({ email: 'chef@test.dev', password: 'test', rememberMe: false }).subscribe();
    bootstrap('anonymous');
    http.expectOne(`${API}/auth/login`).flush({ userId: 1, username: 'chef' });
    const loginRotation = http.expectOne(CSRF);
    http.expectOne(`${API}/auth/session`).flush({ userId: 1, username: 'chef', permissions: [] });
    expect(loginRotation.cancelled).toBe(true);
    expect(store.isAuthenticated()).toBe(true);
    bootstrap('authenticated');
    facade.logout().subscribe();
    const logout = http.expectOne(`${API}/auth/logout`);
    expect(logout.request.headers.get('X-CSRF-TOKEN')).toBe('authenticated');
    logout.flush(null);
    const rotations = http.match(CSRF);
    expect(rotations.filter(request => !request.cancelled)).toHaveLength(1);
    rotations.find(request => !request.cancelled)!.flush({ requestToken: 'logged-out', headerName: 'X-CSRF-TOKEN' });
    expect(store.isAuthenticated()).toBe(false);
    facade.restoreSession$().subscribe();
    http.expectOne(`${API}/auth/session`).flush({ userId: 2, username: 'chef', permissions: [] });
    bootstrap('restored');
    expect(store.isAuthenticated()).toBe(true);
    http.expectNone(`${API}/auth/logout`);
  });

  it('keeps failed logout local cleanup and refetches without replaying logout', () => {
    csrf.acquire().subscribe();
    bootstrap('authenticated');
    TestBed.inject(AuthFacade).logout().subscribe();
    http.expectOne(`${API}/auth/logout`).error(new ProgressEvent('error'));
    bootstrap('after-local-cleanup');
    http.expectNone(`${API}/auth/logout`);
    expect(TestBed.inject(AuthStore).isAuthenticated()).toBe(false);
  });

  it.each([['csrf_invalid', 400, 'failed'], ['network', 0, 'unknownOutcome']])
    ('preserves Meal Plan revision and distinguishes %s from uncertain transport outcome', (code, status, outcome) => {
      const context = TestBed.inject(MealPlanContextStore);
      context.replaceConfirmedRevision('8', context.identityGeneration());
      const results: { outcome: string; code?: string }[] = [];
      TestBed.inject(MealPlanMutationCoordinator).enqueue({
        context: { kind: 'updateNutritionProfile', expectedRevision: '8' },
        mode: 'scalar', resourceKey: 'nutrition-profile',
        execute: revision => client.put<NutritionProfileDto>(`${API}/users/me/nutrition-profile`, {}, {
          headers: { 'X-Meal-Plan-Revision': revision },
        }),
      }).subscribe(result => results.push(result));
      bootstrap('token');
      const request = http.expectOne(`${API}/users/me/nutrition-profile`);
      expect(request.request.headers.get('X-Meal-Plan-Revision')).toBe('8');
      if (status === 0) request.error(new ProgressEvent('error'));
      else request.flush({ code }, { status: 400, statusText: 'Bad Request' });
      expect(results[0]?.outcome).toBe(outcome);
      expect(context.revision()).toBe('8');
      if (status === 400) {
        expect(results[0]?.code).toBe('csrf_invalid');
        bootstrap('fresh');
      }
      http.expectNone(`${API}/users/me/nutrition-profile`);
    });

  function bootstrap(token: string): void {
    const request = http.expectOne(CSRF);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.has('X-CSRF-TOKEN')).toBe(false);
    expect(request.request.headers.has('Origin')).toBe(false);
    request.flush({ requestToken: token, headerName: 'X-CSRF-TOKEN' });
  }
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '@app/core/api/api.config';
import { SKIP_AUTO_LOGOUT } from './auth.request-context';
import { AuthApi } from './auth.api';

describe('AuthApi', () => {
  let api: AuthApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthApi,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
      ],
    });

    api = TestBed.inject(AuthApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the explicit Remember Me choice with login credentials', () => {
    const body = {
      email: 'chef@appetee.dev',
      password: 'password',
      rememberMe: true,
    };

    api.login(body).subscribe();

    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush({ userId: 42, username: 'chef' });
  });

  it('requests password recovery with only the supplied email', () => {
    api.requestPasswordRecovery({ email: 'chef@appetee.dev' }).subscribe();

    const request = http.expectOne('/api/auth/password-recovery/request');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'chef@appetee.dev' });
    expect(request.request.context.get(SKIP_AUTO_LOGOUT)).toBe(true);
    request.flush(null);
  });

  it('confirms recovery without sending password confirmation or identity fields', () => {
    api.confirmPasswordRecovery({
      token: 'single-use-token',
      newPassword: 'new-password',
    }).subscribe();

    const request = http.expectOne('/api/auth/password-recovery/confirm');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      token: 'single-use-token',
      newPassword: 'new-password',
    });
    expect(Object.keys(request.request.body)).toEqual(['token', 'newPassword']);
    expect(request.request.context.get(SKIP_AUTO_LOGOUT)).toBe(true);
    request.flush(null);
  });
});

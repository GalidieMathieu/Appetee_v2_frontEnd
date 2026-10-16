import { DOCUMENT } from '@angular/common';
import { HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, mergeMap, tap, throwError } from 'rxjs';
import { API_URL } from '../api/api.config';
import { isConfiguredApiUrl } from '../api/api-url';
import { CsrfTokenService } from './csrf-token.service';
import { isCsrfInvalidError } from './csrf-error';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const apiUrl = inject(API_URL);
  const baseUrl = inject(DOCUMENT).baseURI;
  if (!isConfiguredApiUrl(req.url, apiUrl, baseUrl)) return next(req);

  const credentialed = req.clone({ withCredentials: true });
  const csrf = inject(CsrfTokenService);
  const path = new URL(req.url, baseUrl).pathname.replace(/\/$/, '');
  const identityResponse = (event: HttpEvent<unknown>): void => {
    if (event instanceof HttpResponse && event.ok
      && ((req.method === 'POST' && ['/api/auth/login', '/api/auth/sign-up', '/api/auth/logout',
          '/api/auth/password-recovery/confirm'].includes(path))
        || (req.method === 'GET' && path === '/api/auth/session')
        || (['PUT', 'DELETE'].includes(req.method) && path === '/api/users/me'))) csrf.reset();
  };

  // The handshake is a safe GET through this same pipeline; it never enters acquire again.
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next(credentialed).pipe(tap(identityResponse));
  }

  return csrf.acquire().pipe(mergeMap(token => {
    if (!csrf.isCurrent(token)) {
      return throwError(() => new Error('The session changed before the request was sent. Please submit again.'));
    }
    return next(credentialed.clone({ setHeaders: { [token.headerName]: token.requestToken } })).pipe(
      tap(identityResponse),
      catchError((error: unknown) => {
        if (isCsrfInvalidError(error)) csrf.reject(token);
        // Preserve the original error and revision. Never resubscribe/replay a mutation.
        return throwError(() => error);
      })
    );
  }));
};

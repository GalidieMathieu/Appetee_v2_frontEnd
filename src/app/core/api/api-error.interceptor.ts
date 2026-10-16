import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { Injector, inject } from '@angular/core';
import { SKIP_AUTO_LOGOUT } from '../auth/data-access/auth.request-context';
import { SessionExpirationService } from '../auth/session-expiration.service';
import { DOCUMENT } from '@angular/common';
import { API_URL } from './api.config';
import { isConfiguredApiUrl } from './api-url';
import { CapabilitiesFacade } from '../auth/data-access/capabilities.facade';

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionExpiration = inject(SessionExpirationService);
  const apiUrl = inject(API_URL); const baseUrl = inject(DOCUMENT).baseURI;
  const injector = inject(Injector);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 403 && isConfiguredApiUrl(req.url, apiUrl, baseUrl)
          && new URL(req.url, baseUrl).pathname.startsWith('/api/admin/')) injector.get(CapabilitiesFacade).deny();
        // Auth endpoints manage expected 401 responses themselves. A 401 from any other API
        // request means the previously accepted browser session is no longer usable.
        if (err.status === 401 && !req.context.get(SKIP_AUTO_LOGOUT)) {
          sessionExpiration.handleExpiration();
        }
      }
      return throwError(() => err);
    })
  );
};

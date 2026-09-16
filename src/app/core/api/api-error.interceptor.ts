import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { SKIP_AUTO_LOGOUT } from '../auth/data-access/auth.request-context';
import { SessionExpirationService } from '../auth/session-expiration.service';

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionExpiration = inject(SessionExpirationService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
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

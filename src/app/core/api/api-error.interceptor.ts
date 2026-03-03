import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { AuthFacade } from '../auth/data-access/auth.facade';

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthFacade);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        // Example global policies:
        if (err.status === 401) {
          // Session expired / not authorized
          auth.logout().subscribe();
        }

        if (err.status >= 500) {
          // Optionally trigger a global “server down” message
          console.error('Server error', err.status, req.url);
        }
      }

      // IMPORTANT: rethrow so feature code can still show local messages
      return throwError(() => err);
    })
  );
};

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { AuthFacade } from '../auth/data-access/auth.facade';
import { SKIP_AUTO_LOGOUT } from '../auth/data-access/auth.request-context';

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthFacade);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        // Only auto-logout for authenticated API calls. Auth endpoints manage their own 401 handling.
        if (err.status === 401 && !req.context.get(SKIP_AUTO_LOGOUT)) {
          auth.logout().subscribe();
        }
      }
      return throwError(() => err);
    })
  );
};

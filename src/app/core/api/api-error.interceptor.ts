import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { AuthFacade } from '../auth/data-access/auth.facade';

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthFacade);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        // only 401 is handle with this, all other error is handle by the facade
        if (err.status === 401) {
          // Session expired / not authorized
          auth.logout().subscribe();
        }
      }
      return throwError(() => err);
    })
  );
};

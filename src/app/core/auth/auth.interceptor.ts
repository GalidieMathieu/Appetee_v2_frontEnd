//Adds cookies automatically for your API calls (so we don’t repeat withCredentials: true).
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_URL } from '../api/api.config';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const apiUrl = inject(API_URL);
  const isApiCall = req.url.startsWith(apiUrl);

  if (!isApiCall) return next(req);

  return next(req.clone({ withCredentials: true }));
};

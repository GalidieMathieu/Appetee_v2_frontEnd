import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  Observable, Subject, catchError, defer, finalize, map, mergeMap, of, race,
  shareReplay, take, tap, throwError, timeout, EMPTY,
} from 'rxjs';

import { API_URL } from '../api/api.config';
import { ResettableStore } from '../shared/utils/resettable-store';
import { SKIP_AUTO_LOGOUT } from './data-access/auth.request-context';

export interface CsrfTokenLease {
  readonly requestToken: string;
  readonly headerName: 'X-CSRF-TOKEN';
  readonly generation: number;
}

/** In-memory only. No cookie reading, browser persistence, mutation replay or second HTTP client. */
@Injectable({ providedIn: 'root' })
export class CsrfTokenService implements ResettableStore {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly invalidated$ = new Subject<void>();
  private generation = 0;
  private token: CsrfTokenLease | null = null;
  private inFlight: Observable<CsrfTokenLease> | null = null;

  acquire(): Observable<CsrfTokenLease> {
    return defer(() => {
      if (this.token !== null) return of(this.token);
      if (this.inFlight !== null) return this.inFlight;
      const generation = this.generation;
      let shared: Observable<CsrfTokenLease>;
      const request = this.http.get<unknown>(`${this.apiUrl.replace(/\/$/, '')}/auth/csrf`, {
        withCredentials: true,
        context: new HttpContext().set(SKIP_AUTO_LOGOUT, true),
      }).pipe(
        // Match existing Core read timeouts; never let bootstrap hold a mutation indefinitely.
        timeout(10000),
        map(body => {
          if (typeof body !== 'object' || body === null
            || !('requestToken' in body) || typeof body.requestToken !== 'string'
            || !body.requestToken.trim() || !('headerName' in body)
            || body.headerName !== 'X-CSRF-TOKEN') {
            throw new Error('The security handshake failed. Please try again.');
          }
          if (generation !== this.generation) throw identityChangedError();
          return { requestToken: body.requestToken, headerName: body.headerName, generation } as const;
        }),
        tap(token => { this.token = token; })
      );
      shared = race(request, this.invalidated$.pipe(
        take(1), mergeMap(() => throwError(identityChangedError))
      )).pipe(
        finalize(() => { if (this.inFlight === shared) this.inFlight = null; }),
        shareReplay({ bufferSize: 1, refCount: true })
      );
      this.inFlight = shared;
      return shared;
    });
  }

  isCurrent(token: CsrfTokenLease): boolean {
    return token.generation === this.generation;
  }

  /** Old-identity requests cannot invalidate a newer identity's token. */
  reject(token: CsrfTokenLease): void {
    if (this.isCurrent(token)) this.reset();
  }

  reset(): void {
    this.generation++;
    this.token = null;
    this.inFlight = null;
    this.invalidated$.next();
    // Refetch only the safe handshake. Failure leaves the token empty for the next explicit intent.
    this.acquire().pipe(catchError(() => EMPTY)).subscribe();
  }
}

function identityChangedError(): Error {
  return new Error('The session changed before the request was sent. Please submit again.');
}

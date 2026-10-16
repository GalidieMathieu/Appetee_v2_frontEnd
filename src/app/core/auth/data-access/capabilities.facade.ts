import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Observable, catchError, defer, filter, finalize, map, shareReplay, takeUntil, tap, throwError, timeout } from 'rxjs';
import { AuthApi } from './auth.api';
import { AuthStore } from './auth.store';
import { CurrentUserSession } from './auth.model';
import { CapabilitiesStore } from './capabilities.store';
import { SessionExpirationService } from '../session-expiration.service';
import { toApiErrorMessage } from '@app/core/shared/data-access/generic-template/api-error-message';
export function validatedSession(value: unknown): CurrentUserSession {
    if (!value || typeof value !== 'object')
        throw new Error('The session API does not expose valid capabilities.');
    const session = value as Partial<CurrentUserSession>;
    if (!Number.isInteger(session.userId) || session.userId! < 1 || session.userId! > 2147483647 || typeof session.username !== 'string' || !Array.isArray(session.permissions) || !session.permissions.every(permission => typeof permission === 'string') || session.permissions.some((permission, index) => index > 0 && session.permissions![index - 1]! >= permission))
        throw new Error('The session API does not expose valid capabilities.');
    return { userId: session.userId!, username: session.username, permissions: session.permissions };
}
class ChangedSessionError extends Error {
}
@Injectable({ providedIn: 'root' })
export class CapabilitiesFacade {
    readonly store = inject(CapabilitiesStore);
    private readonly api = inject(AuthApi);
    private readonly auth = inject(AuthStore);
    private readonly expiration = inject(SessionExpirationService);
    private inFlight: Observable<CurrentUserSession> | null = null;
    constructor() { this.store.reset$.subscribe(() => this.inFlight = null); }
    refresh$(expectedId?: number): Observable<CurrentUserSession> {
        return defer(() => {
            if (this.inFlight)
                return this.inFlight;
            expectedId ??= this.auth.isAuthenticated() ? this.auth.currentSession()?.userId : undefined;
            const generation = this.store.generation();
            this.store.begin();
            let shared: Observable<CurrentUserSession>;
            shared = this.api.refreshSession().pipe(timeout(10000), map(validatedSession), map(session => { if (expectedId !== undefined && session.userId !== expectedId)
                throw new ChangedSessionError('The session identity changed. Sign in again before continuing.'); return session; }), filter(() => this.store.generation() === generation), tap(session => this.store.accept(session)), catchError((error: unknown) => {
                if (this.store.generation() === generation) {
                    this.store.fail(error instanceof HttpErrorResponse && error.status === 401 ? 'unauthenticated' : 'unavailable', toApiErrorMessage(error));
                    if (error instanceof ChangedSessionError || error instanceof HttpErrorResponse && error.status === 401 && this.auth.isAuthenticated())
                        this.expiration.handleExpiration();
                }
                return throwError(() => error);
            }), takeUntil(this.store.reset$), finalize(() => { if (this.inFlight === shared)
                this.inFlight = null; }), shareReplay({ bufferSize: 1, refCount: false }));
            this.inFlight = shared;
            return shared;
        });
    }
    deny(): void { this.store.invalidate('Administrative access was denied. Revalidating your session.'); this.refresh$().subscribe({ error: () => undefined }); }
}

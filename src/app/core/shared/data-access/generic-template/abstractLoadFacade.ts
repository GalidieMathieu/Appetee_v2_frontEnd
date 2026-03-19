import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EntityStore, LoadState } from './entityStore';

export abstract class AbstractLoadFacade<T,
  S extends EntityStore<T> = EntityStore<T>
 > {

  readonly data$: Observable<T>;
  readonly state$: Observable<LoadState>;
  readonly error$: Observable<string | null>;
  readonly loaded$: Observable<boolean>;

  protected constructor(protected readonly store: S) {
    this.data$ = store.data$;
    this.state$ = store.state$;
    this.error$ = store.error$;
    this.loaded$ = store.loaded$;
  }

  /**
   * Indicates whether the store/facade currently has a loaded (successful) value.
   */
  protected isLoaded(): boolean { return this.store.isLoaded(); }


  /**
   * Transitions the store/facade into a "loading" state (e.g., pending request).
  */
  protected setLoading(): void { this.store.setLoading(); }

  /** 
   * Records an error state and associated user-facing message for the current operation.
   * @param message A user-facing error message to display in the UI.
   * @remarks Implementations typically also clear loading state and may clear stale data.
   */
  protected setError(message: string): void { this.store.setError(message); }

  /**
   * Records a successful result and updates the store/facade state accordingly.
   * @param data The successful result payload to store.
   * @remarks Implementations typically also clear loading/error state and mark data as loaded.
   */
  protected setSuccess(data : T): void { this.store.setSuccess(data); }

  /**
   * Records a successful result
   * @remarks Implementations typically also clear loading/error state but when we dont have any data to update.
   */
  protected setSuccessWithNoData(): void { this.store.setSucessWithoutData(); }

  /**
   * Resets the store/facade state back to its initial/default values.
   *
   * @remarks clears loading flags, error messages, and any cached data.
   */
  protected reset(): void { this.store.reset(); }

  
  /**
   * Converts an unknown error into a safe, user-friendly message.
   *
   * @param err The error value thrown/returned by an operation (often an HttpErrorResponse).
   * @returns A user-facing message suitable for UI display.
   * @remarks Handles backend ApiException status codes and falls back to generic network/server messages.
   */
  protected toUserMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const backendMessage = this.extractBackendMessage(err.error);

      switch (err.status) {
        case 0:
          return 'Cannot reach the server. Check your connection and try again.';
        case 400:
          return backendMessage ?? 'Some information is invalid. Please review your input and try again.';
        case 401:
          return backendMessage ?? 'You are not authorized. Please sign in again.';
        case 403:
          return backendMessage ?? 'You do not have permission to perform this action.';
        case 404:
          return backendMessage ?? 'The requested resource was not found.';
        case 409:
          return backendMessage ?? 'This action conflicts with existing data.';
        case 500:
          return backendMessage ?? 'An internal server error occurred. Please try again.';
        default:
          return backendMessage ?? `Request failed (${err.status}).`;
      }
    }

    if (err instanceof Error && err.message.trim()) {
      return err.message.trim();
    }

    return 'Something went wrong. Please try again.';
  }

  private extractBackendMessage(error: unknown): string | null {
    if (typeof error === 'string') {
      const message = error.trim();
      return message || null;
    }

    if (!error || typeof error !== 'object') {
      return null;
    }

    const payload = error as Record<string, unknown>;

    for (const key of ['message', 'detail', 'title', 'error']) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    const errors = payload['errors'];
    if (errors && typeof errors === 'object') {
      for (const value of Object.values(errors as Record<string, unknown>)) {
        if (Array.isArray(value)) {
          const firstMessage = value.find(item => typeof item === 'string' && item.trim());
          if (typeof firstMessage === 'string') {
            return firstMessage.trim();
          }
        }

        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
    }

    return null;
  }
}

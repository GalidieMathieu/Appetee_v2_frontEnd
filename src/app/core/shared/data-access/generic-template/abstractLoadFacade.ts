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
   * @remarks Handles common HTTP/network cases (e.g., 404, 502, offline/CORS) and falls back to a generic message.
   */
  protected toUserMessage(err: unknown): string {
    //TODO handle more error
    if (err instanceof HttpErrorResponse) {
      if (err.status === 404) return 'Endpoint not found (404).';
      if (err.status === 502) return 'Server unavailable (502). Try again.';
      if (err.status === 0) return 'Cannot reach server (network/CORS/offline).';
      return `Request failed (${err.status}).`;
    }
    return 'Request failed.';
  }
}

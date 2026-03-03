import { BehaviorSubject, Observable } from 'rxjs';
import { ResettableStore } from '../../utils/resettable-store';

export type LoadState = 'idle' | 'loading' | 'success' | 'error';

export abstract class EntityStore<T> implements ResettableStore {
  /**
   * Internal subject holding the latest entity data value.
   *
   * @remarks Exposed publicly via {@link data$}. Subclasses can read/write via {@link snapshot} and {@link setSuccess}.
   */
  protected readonly dataSubject: BehaviorSubject<T>;

  /**
   * Stream of entity data updates.
   *
   * @returns Observable that emits the current value immediately and on every subsequent update.
   */
  readonly data$: Observable<T>;

  /**
   * Internal subject representing the current load state (idle/loading/success/error).
   *
   * @remarks Exposed publicly via {@link state$}.
   */
  private readonly stateSubject = new BehaviorSubject<LoadState>('idle');

  /**
   * Stream of load state updates.
   *
   * @returns Observable that emits the current state immediately and on every subsequent update.
   */
  readonly state$ = this.stateSubject.asObservable();

  /**
   * Internal subject holding the current user-facing error message (if any).
   *
   * @remarks Exposed publicly via {@link error$}.
   */
  private readonly errorSubject = new BehaviorSubject<string | null>(null);

  /**
   * Stream of error message updates.
   *
   * @returns Observable that emits the current error value immediately and on every subsequent update.
   */
  readonly error$ = this.errorSubject.asObservable();

  /**
   * Internal subject indicating whether a successful load has occurred.
   *
   * @remarks Exposed publicly via {@link loaded$}. Used by {@link isLoaded}.
   */
  private readonly loadedSubject = new BehaviorSubject<boolean>(false);

  /**
   * Stream that indicates whether the store has successfully loaded data.
   *
   * @returns Observable that emits the current loaded flag immediately and on every subsequent update.
   */
  readonly loaded$ = this.loadedSubject.asObservable();

  isLoading(): boolean {
    return this.stateSubject.value === 'loading';
  }

  /**
   * Creates a new EntityStore with an initial data value.
   *
   * @param initialValue The initial data value used to seed {@link dataSubject}.
   * @remarks This value is used immediately; {@link reset} uses {@link initialValue} instead.
   */
  protected constructor(initialValue: T) {
    this.dataSubject = new BehaviorSubject<T>(initialValue);
    this.data$ = this.dataSubject.asObservable();
  }

  /**
   * Provides the default value used when resetting the store.
   *
   * @returns The default entity value for the store.
   */
  protected abstract initialValue(): T;

  /**
   * Transitions the store into a "loading" state and clears any previous error.
   *
   * @remarks Typically called immediately before starting an async operation.
   * @returns void
   */
  setLoading(): void {
    this.stateSubject.next('loading');
    this.errorSubject.next(null);
  }

  /**
   * Transitions the store into an "error" state and records a user-facing error message.
   *
   * @param message A user-facing error message to display in the UI.
   * @returns void
   */
  setError(message: string): void {
    this.stateSubject.next('error');
    this.errorSubject.next(message);
  }

  /**
   * Records a successful result, marks the store as loaded, and updates the state to "success".
   *
   * @param data The successful result payload to store.
   * @returns void
   */
  setSuccess(data: T): void {
    this.dataSubject.next(data);
    this.loadedSubject.next(true);
    this.stateSubject.next('success');
  }

  /**
   * Marks the store as loaded and updates the state to "success" without updating {@link dataSubject}.
   *
   * @remarks Useful when the data is already up-to-date but the load state needs to be advanced.
   * @returns void
   */
  setSucess(): void {
    this.loadedSubject.next(true);
    this.stateSubject.next('success');
  }

  /**
   * Indicates whether the store has successfully loaded data.
   *
   * @returns True if a success state has been reached; otherwise false.
   */
  isLoaded(): boolean {
    return this.loadedSubject.value;
  }

  /**
   * Resets the store to its initial state.
   *
   * @remarks Restores data to {@link initialValue}, sets state to "idle", clears error, and marks as not loaded.
   * @returns void
   */
  reset(): void {
    this.dataSubject.next(this.initialValue());
    this.stateSubject.next('idle');
    this.errorSubject.next(null);
    this.loadedSubject.next(false);
  }

  /**
   * Returns the current data value synchronously.
   *
   * @returns The latest value held by {@link dataSubject}.
   * @remarks Prefer {@link data$} for reactive usage.
   */
  protected get snapshot(): T {
    return this.dataSubject.value;
  }
}
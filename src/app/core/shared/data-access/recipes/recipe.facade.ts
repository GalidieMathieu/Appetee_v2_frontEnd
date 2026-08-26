import { Injectable, Signal } from '@angular/core';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  filter,
  finalize,
  of,
  shareReplay,
  tap,
  timeout,
} from 'rxjs';

import { EntityRequestState } from '../generic-template/entity-cache-store';
import { toApiErrorMessage } from '../generic-template/api-error-message';
import { RecipeDetailDto } from './recipe.model';
import { RecipesApi } from './recipe.api';
import { RecipeDetailsStore } from './recipe-details.store';

/** Shared by-ID recipe behavior; discovery query/list ownership lives in the Recipes feature. */
@Injectable({ providedIn: 'root' })
export class RecipesFacade {
  private readonly detailRequests = new Map<string, Observable<RecipeDetailDto>>();
  private readonly queryInvalidatedSubject = new Subject<void>();

  readonly queryInvalidated$ = this.queryInvalidatedSubject.asObservable();

  constructor(
    private readonly api: RecipesApi,
    private readonly detailsStore: RecipeDetailsStore
  ) {}

  /** Returns a cached complete detail or coalesces the one in-flight request for this id. */
  getRecipeWithDetails(id: number): Observable<RecipeDetailDto> {
    const cached = this.detailsStore.get(id);
    if (cached) return of(cached);

    const generation = this.detailsStore.generation();
    const requestKey = `${generation}:${id}`;
    const inFlight = this.detailRequests.get(requestKey);
    if (inFlight) return inFlight;

    this.detailsStore.setLoading(id);
    const request$ = this.api.getRecipeWithDetails(id).pipe(
      timeout(10000),
      filter(() => this.detailsStore.generation() === generation),
      tap(detail => this.detailsStore.upsert(detail)),
      catchError((error: unknown) => {
        if (this.detailsStore.generation() === generation) {
          this.detailsStore.setError(id, toApiErrorMessage(error));
        }
        return EMPTY;
      }),
      finalize(() => this.detailRequests.delete(requestKey)),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.detailRequests.set(requestKey, request$);
    return request$;
  }

  /** Compatibility alias retained for existing edit screens. */
  getRecipesWithDetails(id: number): Observable<RecipeDetailDto> {
    return this.getRecipeWithDetails(id);
  }

  invalidateDetail(id: number): void {
    this.detailsStore.invalidate(id);
  }

  detailRequestState(id: number): Signal<EntityRequestState> {
    return this.detailsStore.requestStateFor(id);
  }

  invalidateQueries(): void {
    this.queryInvalidatedSubject.next();
  }
}

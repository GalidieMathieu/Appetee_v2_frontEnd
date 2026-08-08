import { Injectable } from '@angular/core';
import { EMPTY, Observable, catchError, filter, finalize, of, shareReplay, tap, timeout } from 'rxjs';

import { EntityRequestState } from '../../generic-template/entity-cache-store';
import { toApiErrorMessage } from '../../generic-template/api-error-message';
import { AdminIngredientApi } from './admin-ingredient.api';
import { IngredientDetailsStore } from './ingredient-details.store';
import { IngredientAdminDetailDto } from '../ingredient.model';

@Injectable({ providedIn: 'root' })
export class IngredientDetailsFacade {
  private readonly requests = new Map<string, Observable<IngredientAdminDetailDto>>();

  constructor(
    private readonly api: AdminIngredientApi,
    private readonly store: IngredientDetailsStore
  ) {}

  get(id: number): Observable<IngredientAdminDetailDto> {
    const cached = this.store.get(id);
    if (cached) return of(cached);

    const generation = this.store.generation();
    const requestKey = `${generation}:${id}`;
    const inFlight = this.requests.get(requestKey);
    if (inFlight) return inFlight;

    this.store.setLoading(id);
    const request$ = this.api.getDetail(id).pipe(
      timeout(10000),
      filter(() => this.store.generation() === generation),
      tap(detail => this.store.upsert(detail)),
      catchError((error: unknown) => {
        if (this.store.generation() === generation) {
          this.store.setError(id, toApiErrorMessage(error));
        }
        return EMPTY;
      }),
      finalize(() => this.requests.delete(requestKey)),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.requests.set(requestKey, request$);
    return request$;
  }

  requestState(id: number): EntityRequestState {
    return this.store.requestState(id);
  }

  invalidate(id: number): void {
    this.store.invalidate(id);
  }
}

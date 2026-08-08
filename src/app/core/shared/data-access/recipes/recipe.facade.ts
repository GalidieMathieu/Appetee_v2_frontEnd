import { Injectable } from '@angular/core';
import { Signal } from '@angular/core';
import {
  EMPTY,
  Observable,
  catchError,
  filter,
  finalize,
  map,
  of,
  shareReplay,
  tap,
  timeout,
} from 'rxjs';

import { AbstractLoadFacade } from '../generic-template/abstractLoadFacade';
import { EntityRequestState } from '../generic-template/entity-cache-store';
import { RecipeCardDto, RecipeDetailDto } from './recipe.model';
import { RecipesApi } from './recipe.api';
import { RecipeDetailsStore } from './recipe-details.store';
import { RecipesStore } from './recipes.store';

@Injectable({ providedIn: 'root' })
export class RecipesFacade extends AbstractLoadFacade<RecipeCardDto[], RecipesStore> {
  private readonly detailRequests = new Map<string, Observable<RecipeDetailDto>>();

  constructor(
    private readonly api: RecipesApi,
    private readonly detailsStore: RecipeDetailsStore,
    store: RecipesStore
  ) {
    super(store);
  }

  readonly recipes$ = this.data$.pipe(map(recipes => recipes as readonly RecipeCardDto[]));

  loadIfNeeded(): void {
    if (!this.isLoaded()) this.load();
  }

  reload(): void {
    this.reset();
    this.load();
  }

  load(): void {
    if (this.store.isLoading()) return;
    this.setLoading();

    this.api.getAll().pipe(
      timeout(10000),
      catchError((error: unknown) => {
        this.setError(this.toUserMessage(error));
        return EMPTY;
      })
    ).subscribe(data => this.setSuccess(data));
  }

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
          this.detailsStore.setError(id, this.toUserMessage(error));
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
    this.store.reset();
  }
}

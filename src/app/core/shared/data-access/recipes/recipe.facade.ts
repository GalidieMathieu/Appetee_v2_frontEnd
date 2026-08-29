/**
 * Shared by-ID recipe data orchestration for Preview/detail caches and favorite membership.
 * Discovery criteria/order remain feature-owned while Phase 12 Preview data stays session-scoped.
 */
import { Injectable, Signal, computed, signal } from '@angular/core';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  filter,
  finalize,
  map,
  of,
  shareReplay,
  tap,
  timeout,
} from 'rxjs';

import { EntityRequestState } from '../generic-template/entity-cache-store';
import { toApiErrorMessage } from '../generic-template/api-error-message';
import {
  FavoriteMutationFeedback,
  FavoriteMembershipState,
  FavoriteMutationState,
  RecipeCardDto,
  RecipeDetailDto,
  RecipePreviewDto,
} from './recipe.model';
import { RecipesApi } from './recipe.api';
import { RecipeDetailsStore } from './recipe-details.store';
import { RecipePreviewStore } from './recipe-preview.store';
import { RecipesStore } from './recipes.store';

/** Shared by-ID recipe behavior; discovery query/list ownership lives in the Recipes feature. */
@Injectable({ providedIn: 'root' })
export class RecipesFacade {
  private readonly detailRequests = new Map<string, Observable<RecipeDetailDto>>();
  private readonly previewRequests = new Map<string, Observable<RecipePreviewDto>>();
  private readonly favoriteRequests = new Set<string>();
  private readonly favoriteMutationsSignal = signal<
    Readonly<Record<number, FavoriteMutationState>>
  >({});
  private readonly favoriteMembershipSignal = signal<
    Readonly<Record<number, FavoriteMembershipState>>
  >({});
  private readonly favoriteFeedbackSignal = signal<
    (FavoriteMutationFeedback & { readonly generation: number }) | null
  >(null);
  private readonly queryInvalidatedSubject = new Subject<void>();

  readonly queryInvalidated$ = this.queryInvalidatedSubject.asObservable();
  readonly favoriteFeedback = computed<FavoriteMutationFeedback | null>(() => {
    const feedback = this.favoriteFeedbackSignal();
    return feedback?.generation === this.recipesStore.state().generation
      ? { recipeId: feedback.recipeId, message: feedback.message }
      : null;
  });

  constructor(
    private readonly api: RecipesApi,
    private readonly detailsStore: RecipeDetailsStore,
    private readonly recipesStore: RecipesStore,
    private readonly previewStore: RecipePreviewStore
  ) {}

  /** Returns a cached Preview or coalesces one same-ID request for the active identity generation. */
  getPreview(id: number): Observable<RecipePreviewDto> {
    const cached = this.previewStore.get(id);
    if (cached) return of(cached);

    const generation = this.previewStore.generation();
    const invalidationVersion = this.previewStore.invalidationVersion(id);
    const requestKey = `${generation}:${id}:${invalidationVersion}`;
    const inFlight = this.previewRequests.get(requestKey);
    if (inFlight) return inFlight;

    this.previewStore.setLoading(id);
    const request$ = this.api.getPreview(id).pipe(
      timeout(10000),
      filter(() => this.previewStore.isRequestCurrent(
        id,
        generation,
        invalidationVersion
      )),
      map(preview => {
        const membership = this.favoriteMembershipSignal()[id];
        return membership?.previewGeneration === generation
          ? { ...preview, isSaved: membership.isSaved }
          : preview;
      }),
      tap(preview => this.previewStore.upsert(preview)),
      catchError((error: unknown) => {
        if (this.previewStore.isRequestCurrent(id, generation, invalidationVersion)) {
          this.previewStore.setError(id, toApiErrorMessage(error));
        }
        return EMPTY;
      }),
      finalize(() => this.previewRequests.delete(requestKey)),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.previewRequests.set(requestKey, request$);
    return request$;
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

  invalidatePreview(id: number): void {
    this.previewStore.invalidate(id);
  }

  previewRequestState(id: number): Signal<EntityRequestState> {
    return this.previewStore.requestStateFor(id);
  }

  /** Exposes one cached Preview reactively without giving UI components direct store ownership. */
  previewFor(id: number): Signal<RecipePreviewDto | null> {
    return computed(() => this.previewStore.get(id));
  }

  /** Keeps an open Preview synchronized with the card projection patched by favorite mutations. */
  cardFor(id: number): Signal<RecipeCardDto | null> {
    return computed(() => this.recipesStore.card(id));
  }

  detailRequestState(id: number): Signal<EntityRequestState> {
    return this.detailsStore.requestStateFor(id);
  }

  isFavoritePending(recipeId: number): boolean {
    const mutation = this.favoriteMutationsSignal()[recipeId];
    return mutation?.previewGeneration === this.previewStore.generation();
  }

  /** Resolves synchronized membership for Cards that may not belong to Recipe Discovery. */
  favoriteSavedState(recipeId: number, fallback: boolean): boolean {
    const membership = this.favoriteMembershipSignal()[recipeId];
    if (membership?.previewGeneration === this.previewStore.generation()) {
      return membership.isSaved;
    }
    return this.previewStore.get(recipeId)?.isSaved
      ?? this.recipesStore.card(recipeId)?.isSaved
      ?? fallback;
  }

  /** Mutates shared membership from a cached entity or a caller's complete Card projection. */
  toggleFavorite(recipeId: number, currentSavedState?: boolean): void {
    const card = this.recipesStore.card(recipeId);
    const preview = this.previewStore.get(recipeId);
    const knownSavedState = currentSavedState ?? preview?.isSaved ?? card?.isSaved;
    if (knownSavedState === undefined) return;

    const recipeGeneration = this.recipesStore.state().generation;
    const previewGeneration = this.previewStore.generation();
    const requestKey = `${previewGeneration}:${recipeId}`;
    if (this.favoriteRequests.has(requestKey)) return;

    // Shared Preview consumers may not belong to Discovery, so either complete known projection
    // can establish the authoritative previous membership for the optimistic transition.
    const previousSaved = this.favoriteSavedState(recipeId, knownSavedState);
    const desiredSaved = !previousSaved;
    this.favoriteRequests.add(requestKey);
    this.favoriteFeedbackSignal.set(null);
    this.favoriteMutationsSignal.update(states => ({
      ...states,
      [recipeId]: { recipeGeneration, previewGeneration, desiredSaved },
    }));
    this.favoriteMembershipSignal.update(states => ({
      ...states,
      [recipeId]: { previewGeneration, isSaved: desiredSaved },
    }));
    this.recipesStore.updateSaved(recipeId, desiredSaved);
    this.previewStore.updateSaved(recipeId, desiredSaved);

    const request$ = desiredSaved
      ? this.api.saveFavorite(recipeId)
      : this.api.removeFavorite(recipeId);

    request$.pipe(
      timeout(10000),
      catchError((error: unknown) => {
        if (this.recipesStore.state().generation === recipeGeneration) {
          this.recipesStore.updateSaved(recipeId, previousSaved);
        }
        if (this.previewStore.generation() === previewGeneration) {
          this.previewStore.updateSaved(recipeId, previousSaved);
          this.favoriteMembershipSignal.update(states => ({
            ...states,
            [recipeId]: { previewGeneration, isSaved: previousSaved },
          }));
        }
        if (this.recipesStore.state().generation === recipeGeneration) {
          const action = desiredSaved ? 'save' : 'remove';
          this.favoriteFeedbackSignal.set({
            generation: recipeGeneration,
            recipeId,
            message: `Could not ${action} this recipe. ${toApiErrorMessage(error)}`,
          });
        }
        return EMPTY;
      }),
      finalize(() => {
        this.favoriteRequests.delete(requestKey);
        this.favoriteMutationsSignal.update(states => {
          const mutation = states[recipeId];
          if (
            mutation?.recipeGeneration !== recipeGeneration
            || mutation.previewGeneration !== previewGeneration
          ) {
            return states;
          }
          const nextStates = { ...states };
          delete nextStates[recipeId];
          return nextStates;
        });
      })
    ).subscribe();
  }

  dismissFavoriteFeedback(): void {
    this.favoriteFeedbackSignal.set(null);
  }

  invalidateQueries(): void {
    this.queryInvalidatedSubject.next();
  }
}

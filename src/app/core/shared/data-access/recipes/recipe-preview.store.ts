/**
 * Session-scoped cache for complete lightweight Recipe Preview entities loaded independently by ID.
 * It stays separate from discovery queries so search/filter replacement cannot discard reusable data.
 */
import { Injectable } from '@angular/core';

import { EntityCacheStore } from '../generic-template/entity-cache-store';
import { RecipePreviewDto } from './recipe.model';

@Injectable({ providedIn: 'root' })
export class RecipePreviewStore extends EntityCacheStore<RecipePreviewDto> {
  private readonly invalidationVersionById = new Map<number, number>();

  invalidationVersion(recipeId: number): number {
    return this.invalidationVersionById.get(recipeId) ?? 0;
  }

  /** Confirms both identity generation and per-ID invalidation still match a request start. */
  isRequestCurrent(
    recipeId: number,
    generation: number,
    invalidationVersion: number
  ): boolean {
    return this.generation() === generation
      && this.invalidationVersion(recipeId) === invalidationVersion;
  }

  /** Patches favorite membership only when this Preview is already cached. */
  updateSaved(recipeId: number, isSaved: boolean): boolean {
    const preview = this.get(recipeId);
    if (!preview) return false;

    this.upsert({ ...preview, isSaved });
    return true;
  }

  /** Invalidates one entity and advances its token so an older in-flight response is rejected. */
  override invalidate(recipeId: number): void {
    super.invalidate(recipeId);
    this.invalidationVersionById.set(
      recipeId,
      this.invalidationVersion(recipeId) + 1
    );
  }

  override reset(): void {
    super.reset();
    this.invalidationVersionById.clear();
  }
}

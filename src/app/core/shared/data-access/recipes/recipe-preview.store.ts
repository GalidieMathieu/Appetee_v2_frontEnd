/**
 * Session-scoped cache for complete lightweight Recipe Preview entities loaded independently by ID.
 * It stays separate from discovery queries so search/filter replacement cannot discard reusable data.
 */
import { Injectable } from '@angular/core';

import { EntityCacheStore } from '../generic-template/entity-cache-store';
import { RecipePreviewDto } from './recipe.model';

@Injectable({ providedIn: 'root' })
export class RecipePreviewStore extends EntityCacheStore<RecipePreviewDto> {
  /** Patches favorite membership only when this Preview is already cached. */
  updateSaved(recipeId: number, isSaved: boolean): boolean {
    const preview = this.get(recipeId);
    if (!preview) return false;

    this.upsert({ ...preview, isSaved });
    return true;
  }

}

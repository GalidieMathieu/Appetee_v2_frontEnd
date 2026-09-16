/**
 * Identity-scoped typed cache for authorized Cooking Views, kept separate from authoring details.
 * Generic entity-cache behavior owns request state, reset, and per-ID invalidation mechanics.
 */
import { Injectable } from '@angular/core';

import { EntityCacheStore } from '../generic-template/entity-cache-store';
import { RecipeCookingViewDto } from './recipe.model';

@Injectable({ providedIn: 'root' })
export class RecipeCookingStore extends EntityCacheStore<RecipeCookingViewDto> {}

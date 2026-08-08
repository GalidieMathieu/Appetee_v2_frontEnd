import { Injectable } from '@angular/core';

import { EntityCacheStore } from '../generic-template/entity-cache-store';
import { RecipeDetailDto } from './recipe.model';

/** Application/identity-scoped cache of complete recipes requested by id. */
@Injectable({ providedIn: 'root' })
export class RecipeDetailsStore extends EntityCacheStore<RecipeDetailDto> {}

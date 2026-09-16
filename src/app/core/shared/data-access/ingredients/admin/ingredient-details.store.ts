import { Injectable } from '@angular/core';

import { EntityCacheStore } from '../../generic-template/entity-cache-store';
import { IngredientAdminDetailDto } from '../ingredient.model';

/** Application/identity-scoped cache of complete ingredient details requested by id. */
@Injectable({ providedIn: 'root' })
export class IngredientDetailsStore extends EntityCacheStore<IngredientAdminDetailDto> {}

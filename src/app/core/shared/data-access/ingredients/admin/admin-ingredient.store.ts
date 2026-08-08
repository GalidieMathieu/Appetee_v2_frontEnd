import { Injectable } from '@angular/core';

import { EntityStore } from '../../generic-template/entityStore';

/** Request state for ingredient administration mutations only. */
@Injectable({ providedIn: 'root' })
export class AdminIngredientStore extends EntityStore<null> {
  constructor() {
    super(null);
  }

  protected initialValue(): null {
    return null;
  }
}

import { Injectable } from '@angular/core';

import { EntityStore } from '../../generic-template/entityStore';

/** Independent request state for recipe administration mutations. */
@Injectable({ providedIn: 'root' })
export class AdminRecipeStore extends EntityStore<null> {
  constructor() {
    super(null);
  }

  protected initialValue(): null {
    return null;
  }
}

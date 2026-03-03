import { Injectable } from '@angular/core';
import { EntityStore } from '../generic-template/entityStore';
import { Diet } from './diet.model';

@Injectable({ providedIn: 'root' })
export class DietsStore extends EntityStore<Diet[]> {
  constructor() {
    super([]);
  }

  protected initialValue(): Diet[] {
    return [];
  }
}

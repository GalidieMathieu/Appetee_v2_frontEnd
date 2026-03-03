import { Injectable } from '@angular/core';
import { EntityStore } from '../generic-template/entityStore';
import { User } from './user.model';

@Injectable({ providedIn: 'root' })
export class UserStore extends EntityStore<User | null> {
  constructor() {
    super(null);
  }

  protected initialValue(): User | null {
    return null;
  }
}

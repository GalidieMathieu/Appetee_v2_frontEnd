import { Inject, Injectable } from '@angular/core';
import { SESSION_RESETTERS } from './session-reset.token';
import { ResettableStore } from '../shared/utils/resettable-store';

@Injectable({ providedIn: 'root' })
export class SessionService {
  constructor(
    @Inject(SESSION_RESETTERS) private readonly resetters: ResettableStore[]
  ) {}

  resetAll(): void {
    for (const r of this.resetters) r.reset();
  }
}

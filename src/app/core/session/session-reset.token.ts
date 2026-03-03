import { InjectionToken } from '@angular/core';
import { ResettableStore } from '../shared/utils/resettable-store';

export const SESSION_RESETTERS = new InjectionToken<ResettableStore[]>(
  'SESSION_RESETTERS'
);

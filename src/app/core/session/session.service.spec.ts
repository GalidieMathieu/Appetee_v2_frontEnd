import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SESSION_RESETTERS } from './session-reset.token';
import { SessionService } from './session.service';

describe('SessionService', () => {
  it('resets every registered user-scoped store', () => {
    const resetters = [{ reset: vi.fn() }, { reset: vi.fn() }, { reset: vi.fn() }];
    TestBed.configureTestingModule({
      providers: [SessionService, { provide: SESSION_RESETTERS, useValue: resetters }],
    });

    TestBed.inject(SessionService).resetAll();

    for (const resetter of resetters) {
      expect(resetter.reset).toHaveBeenCalledTimes(1);
    }
  });
});

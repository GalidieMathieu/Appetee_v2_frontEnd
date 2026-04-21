import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { guestGuard } from './guest.guard';
import { AuthStore } from './data-access/auth.store';

describe('guestGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
  });

  it('allows visitors who are not authenticated', () => {
    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));

    expect(result).toBe(true);
  });

  it('redirects authenticated users to the home page', () => {
    const auth = TestBed.inject(AuthStore);
    auth.isAuthenticated.set(true);
    const router = TestBed.inject(Router);

    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));

    expect(router.serializeUrl(result as UrlTree)).toBe('/home');
  });
});

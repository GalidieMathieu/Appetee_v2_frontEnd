import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { catalogueGuard } from './catalogue.guard';
import { AuthStore } from './data-access/auth.store';
import { CapabilitiesStore } from './data-access/capabilities.store';
import { CapabilitiesFacade } from './data-access/capabilities.facade';
describe('E002 catalogue guard', () => {
    const refresh = vi.fn();
    beforeEach(() => { TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: CapabilitiesFacade, useValue: { refresh$: refresh } }] }); });
    function run(required: string[], permissions: string[], authenticated = true, failed = false) {
        const auth = TestBed.inject(AuthStore);
        auth.isAuthenticated.set(authenticated);
        const store = TestBed.inject(CapabilitiesStore);
        store.accept({ userId: 1, username: 'chef', permissions });
        const facade = TestBed.inject(CapabilitiesFacade);
        Object.assign(facade, { store });
        refresh.mockReset().mockReturnValue(failed ? throwError(() => new Error('unavailable')) : of({}));
        return TestBed.runInInjectionContext(() => catalogueGuard({ data: { cataloguePermissions: required } } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    }
    it('sends anonymous users to existing login without fetching capabilities', () => { const result = run(['Catalog.Write'], [], false); expect(TestBed.inject(Router).serializeUrl(result as any)).toBe('/auth/login'); expect(refresh).not.toHaveBeenCalled(); });
    it.each([['Catalog.ReadAdmin', false], ['Catalog.Write', true]])('allows create independently for %s', async (permission, allowed) => { const result = await import('rxjs').then(({ firstValueFrom }) => firstValueFrom(run(['Catalog.Write'], [permission]) as any)); expect(result === true).toBe(allowed); });
    it('requires read AND write for protected editing', async () => { const { firstValueFrom } = await import('rxjs'); const denied = await firstValueFrom(run(['Catalog.ReadAdmin', 'Catalog.Write'], ['Catalog.Write']) as any); expect(TestBed.inject(Router).serializeUrl(denied as any)).toBe('/home'); expect(await firstValueFrom(run(['Catalog.ReadAdmin', 'Catalog.Write'], ['Catalog.ReadAdmin', 'Catalog.Write']) as any)).toBe(true); });
    it('fails closed when revalidation fails rather than reusing cached grants', async () => { const { firstValueFrom } = await import('rxjs'); const denied = await firstValueFrom(run(['Catalog.Write'], ['Catalog.Write'], true, true) as any); expect(TestBed.inject(Router).serializeUrl(denied as any)).toBe('/home'); });
});

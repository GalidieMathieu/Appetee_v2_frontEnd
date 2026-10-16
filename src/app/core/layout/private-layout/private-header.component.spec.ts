import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { PrivateHeaderComponent } from './private-header.component';
import { AuthFacade } from '@app/core/auth/data-access/auth.facade';
import { CapabilitiesFacade } from '@app/core/auth/data-access/capabilities.facade';
import { CapabilitiesStore } from '@app/core/auth/data-access/capabilities.store';
import { UserFacade } from '@app/core/shared/data-access/user/user.facade';
describe('E002 private navigation', () => {
    it('has one Meal Plan entry in each desktop/mobile navigation, independent of catalogue grants', () => {
        const fixture = TestBed.createComponent(PrivateHeaderComponent); fixture.detectChanges();
        expect(fixture.componentInstance.nav().filter(item => item.path === '/meal-plan')).toHaveLength(1);
        expect(fixture.nativeElement.querySelectorAll('a[href="/meal-plan"]')).toHaveLength(2);
    });
    const refresh = vi.fn();
    beforeEach(() => { refresh.mockReset().mockReturnValue(of({})); TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthFacade, useValue: { logout: () => of(undefined) } }, { provide: UserFacade, useValue: { username$: of('chef') } }, { provide: CapabilitiesFacade, useValue: { refresh$: refresh } }] }); });
    it.each([[], ['Catalog.ReadAdmin'], ['Catalog.Write'], ['Catalog.ReadAdmin', 'Catalog.Write']])('filters desktop and mobile administrative links for %j', (...permissions: string[]) => { const store = TestBed.inject(CapabilitiesStore); store.accept({ userId: 1, username: 'chef', permissions }); const fixture = TestBed.createComponent(PrivateHeaderComponent); fixture.detectChanges(); expect(fixture.nativeElement.querySelectorAll('a[href="/admin-recipes/create"]')).toHaveLength(permissions.includes('Catalog.Write') ? 2 : 0); store.begin(); fixture.detectChanges(); expect(fixture.nativeElement.querySelectorAll('a[href="/admin-recipes/create"]')).toHaveLength(0); });
    it('revalidates on focus and removes grants on reset without a second navigation source', () => { const store = TestBed.inject(CapabilitiesStore); store.accept({ userId: 1, username: 'chef', permissions: ['Catalog.Write'] }); const fixture = TestBed.createComponent(PrivateHeaderComponent); fixture.detectChanges(); fixture.componentInstance.revalidateCapabilities(); expect(refresh).toHaveBeenCalledTimes(1); store.reset(); fixture.detectChanges(); expect(fixture.nativeElement.querySelectorAll('a[href="/admin-recipes/create"]')).toHaveLength(0); });
});

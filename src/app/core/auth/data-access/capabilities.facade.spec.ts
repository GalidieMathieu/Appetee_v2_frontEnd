import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthApi } from './auth.api';
import { AuthStore } from './auth.store';
import { CapabilitiesStore } from './capabilities.store';
import { CapabilitiesFacade } from './capabilities.facade';
import { CatalogueStateStore } from '@app/core/shared/data-access/catalogue/catalogue-state.store';
import { SessionExpirationService } from '../session-expiration.service';
describe('E002 capabilities', () => {
    const refreshSession = vi.fn(), handleExpiration = vi.fn();
    let facade: CapabilitiesFacade, store: CapabilitiesStore;
    beforeEach(() => { refreshSession.mockReset(); handleExpiration.mockReset(); TestBed.configureTestingModule({ providers: [{ provide: AuthApi, useValue: { refreshSession } }, { provide: SessionExpirationService, useValue: { handleExpiration } }] }); facade = TestBed.inject(CapabilitiesFacade); store = facade.store; });
    it.each([['Catalog.ReadAdmin', true, false, false], ['Catalog.Write', false, true, false], ['both', true, true, true], ['unknown', false, false, false]])('keeps permissions independent for %s', async (code, read, write, edit) => { refreshSession.mockReturnValue(of({ userId: 1, username: 'chef', permissions: code === 'both' ? ['Catalog.ReadAdmin', 'Catalog.Write'] : [code] })); await firstValueFrom(facade.refresh$()); expect(store.canRead()).toBe(read); expect(store.canWrite()).toBe(write); expect(store.canEdit()).toBe(edit); });
    it.each([undefined, null, 'Catalog.Write', [true]])('fails closed on invalid permissions %j', async (permissions) => { refreshSession.mockReturnValue(of({ userId: 1, username: 'chef', permissions })); await expect(firstValueFrom(facade.refresh$())).rejects.toBeTruthy(); expect(store.status()).toBe('unavailable'); expect(store.canWrite()).toBe(false); expect(store.error()).toContain('capabilities'); });
    it('coalesces concurrent refresh and never enables stale controls while loading', async () => { const response = new Subject<any>(); refreshSession.mockReturnValue(response); store.accept({ userId: 1, username: 'chef', permissions: ['Catalog.Write'] }); const a = firstValueFrom(facade.refresh$()), b = firstValueFrom(facade.refresh$()); expect(store.status()).toBe('loading'); expect(store.canWrite()).toBe(false); expect(refreshSession).toHaveBeenCalledTimes(1); response.next({ userId: 1, username: 'chef', permissions: [] }); response.complete(); expect(await a).toEqual(await b); expect(store.canWrite()).toBe(false); });
    it('does not repopulate the next identity from a late session response', () => { const response = new Subject<any>(); refreshSession.mockReturnValue(response); const received: any[] = []; facade.refresh$().subscribe(value => received.push(value)); store.reset(); response.next({ userId: 1, username: 'old', permissions: ['Catalog.Write'] }); expect(received).toEqual([]); expect(store.status()).toBe('unauthenticated'); expect(store.permissions()).toEqual([]); });
    it('clears administrative records and origin ETags on permission removal', async () => { store.accept({ userId: 1, username: 'chef', permissions: ['Catalog.ReadAdmin', 'Catalog.Write'] }); const catalogue = TestBed.inject(CatalogueStateStore); catalogue.reviewedEtags.set({ 42: '"catalog-recipe-42-v1"' }); refreshSession.mockReturnValue(of({ userId: 1, username: 'chef', permissions: [] })); await firstValueFrom(facade.refresh$()); expect(catalogue.reviewedEtags()).toEqual({}); expect(catalogue.recipes()).toEqual({}); });
    it('uses existing session expiry on authenticated stale-session 401', async () => { TestBed.inject(AuthStore).isAuthenticated.set(true); refreshSession.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 }))); await expect(firstValueFrom(facade.refresh$())).rejects.toBeTruthy(); expect(handleExpiration).toHaveBeenCalledTimes(1); expect(store.canWrite()).toBe(false); });
    it('rejects a changed identity instead of attaching its grants to the old account', async () => { refreshSession.mockReturnValue(of({ userId: 2, username: 'other', permissions: ['Catalog.Write'] })); await expect(firstValueFrom(facade.refresh$(1))).rejects.toBeTruthy(); expect(handleExpiration).toHaveBeenCalledTimes(1); expect(store.canWrite()).toBe(false); });
    it('times out a hanging capability refresh without retaining privilege', async () => { vi.useFakeTimers(); try {
        refreshSession.mockReturnValue(new Subject());
        const result = firstValueFrom(facade.refresh$()).catch(error => error);
        await vi.advanceTimersByTimeAsync(10001);
        expect(await result).toBeTruthy();
        expect(store.status()).toBe('unavailable');
        expect(store.canRead()).toBe(false);
    }
    finally {
        vi.useRealTimers();
    } });
    it('does not reuse a pre-denial capability response when revalidating 403', () => { const old = new Subject<any>(), fresh = new Subject<any>(); refreshSession.mockReturnValueOnce(old).mockReturnValueOnce(fresh); facade.refresh$().subscribe(); facade.deny(); expect(refreshSession).toHaveBeenCalledTimes(2); old.next({ userId: 1, username: 'chef', permissions: ['Catalog.ReadAdmin', 'Catalog.Write'] }); expect(store.canEdit()).toBe(false); fresh.next({ userId: 1, username: 'chef', permissions: [] }); fresh.complete(); expect(store.status()).toBe('authenticated'); expect(store.canEdit()).toBe(false); });
});

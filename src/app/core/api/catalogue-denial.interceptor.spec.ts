import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { apiErrorInterceptor } from './api-error.interceptor';
import { API_URL } from './api.config';
import { CapabilitiesFacade } from '../auth/data-access/capabilities.facade';
import { SessionExpirationService } from '../auth/session-expiration.service';
describe('E002 authoritative denial routing', () => {
    const deny = vi.fn(), expire = vi.fn();
    beforeEach(() => { deny.mockReset(); expire.mockReset(); TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting(), { provide: API_URL, useValue: 'https://api.example.test/api' }, { provide: CapabilitiesFacade, useValue: { deny } }, { provide: SessionExpirationService, useValue: { handleExpiration: expire } }] }); });
    afterEach(() => TestBed.inject(HttpTestingController).verify());
    it.each([['https://api.example.test/api/admin/recipe-details', true], ['https://api.example.test/api/administrator/mutation', false], ['https://api.example.test.evil.test/api/admin/recipe-details', false], ['https://other.test/api/admin/recipe-details', false]])('revalidates only actual configured admin denial for %s', (url, revalidates) => { TestBed.inject(HttpClient).post(url, {}).subscribe({ error: () => undefined }); TestBed.inject(HttpTestingController).expectOne(url).flush({}, { status: 403, statusText: 'Forbidden' }); expect(deny).toHaveBeenCalledTimes(revalidates ? 1 : 0); TestBed.inject(HttpTestingController).expectNone(url); });
    it('keeps existing 401 session cleanup instead of converting it into permission revalidation', () => { const url = 'https://api.example.test/api/admin/recipe-details'; TestBed.inject(HttpClient).get(url).subscribe({ error: () => undefined }); TestBed.inject(HttpTestingController).expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' }); expect(expire).toHaveBeenCalledTimes(1); expect(deny).not.toHaveBeenCalled(); });
});

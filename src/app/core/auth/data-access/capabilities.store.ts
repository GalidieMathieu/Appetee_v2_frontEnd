import { Injectable, computed, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { CatalogueStateStore } from '@app/core/shared/data-access/catalogue/catalogue-state.store';
import { CurrentUserSession } from './auth.model';
export type CataloguePermission = 'Catalog.ReadAdmin' | 'Catalog.Write';
export type CapabilityStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'unavailable';
@Injectable({ providedIn: 'root' })
export class CapabilitiesStore {
    private readonly catalogue = inject(CatalogueStateStore);
    readonly status = signal<CapabilityStatus>('unauthenticated');
    readonly permissions = signal<readonly CataloguePermission[]>([]);
    readonly error = signal<string | null>(null);
    readonly generation = signal(0);
    readonly notice = signal<string | null>(null);
    private previous: readonly CataloguePermission[] = [];
    private readonly resets = new Subject<void>();
    readonly reset$ = this.resets.asObservable();
    readonly canRead = computed(() => this.status() === 'authenticated' && this.permissions().includes('Catalog.ReadAdmin'));
    readonly canWrite = computed(() => this.status() === 'authenticated' && this.permissions().includes('Catalog.Write'));
    readonly canEdit = computed(() => this.canRead() && this.canWrite());
    begin(): void { this.status.set('loading'); this.error.set(null); }
    accept(session: CurrentUserSession): void {
        const permissions = [...new Set(session.permissions.filter((permission): permission is CataloguePermission => permission === 'Catalog.ReadAdmin' || permission === 'Catalog.Write'))];
        if (this.previous.some(permission => !permissions.includes(permission))) {
            this.catalogue.reset();
            this.notice.set('Your administrative permissions changed. The restricted workspace was cleared.');
        }
        this.previous = permissions;
        this.permissions.set(permissions);
        this.status.set('authenticated');
        this.error.set(null);
    }
    fail(status: 'unauthenticated' | 'unavailable', message: string): void { this.permissions.set([]); this.previous = []; this.status.set(status); this.error.set(message); this.notice.set(message || null); this.catalogue.reset(); }
    invalidate(message: string): void { this.generation.update(value => value + 1); this.fail('unavailable', message); this.resets.next(); }
    reset(): void { this.generation.update(value => value + 1); this.fail('unauthenticated', ''); this.error.set(null); this.notice.set(null); this.resets.next(); }
}

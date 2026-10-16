import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, defaultIfEmpty, map, of } from 'rxjs';
import { AuthStore } from './data-access/auth.store';
import { CapabilitiesFacade } from './data-access/capabilities.facade';
import { CataloguePermission } from './data-access/capabilities.store';
export const catalogueGuard: CanActivateFn = route => {
    const auth = inject(AuthStore), capabilities = inject(CapabilitiesFacade), router = inject(Router);
    if (!auth.isAuthenticated())
        return router.createUrlTree(['/auth/login']);
    const required = route.data['cataloguePermissions'] as readonly CataloguePermission[] | undefined;
    return capabilities.refresh$(auth.currentSession()?.userId).pipe(map(() => required?.length && required.every(permission => capabilities.store.permissions().includes(permission)) ? true : router.createUrlTree(['/home'])), catchError(() => of(router.createUrlTree([auth.isAuthenticated() ? '/home' : '/auth/login']))), defaultIfEmpty(router.createUrlTree(['/auth/login'])));
};

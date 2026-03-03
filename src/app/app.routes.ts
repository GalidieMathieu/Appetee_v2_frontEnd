import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './core/layout/public-layout/public-layout.component';
import { LANDING_ROUTES } from './features/landing/landing.routes';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import { PrivateLayoutComponent } from './core/layout/private-layout/private-layout.component';

export const routes: Routes = [
    /*{
        path: '',
        component: PublicLayoutComponent,
        children: [
            ...LANDING_ROUTES,
            ...AUTH_ROUTES,
        ]
    },*/
    {
        path: '',
        component: PrivateLayoutComponent,
        //canActivate: [guestGuard],
        /*children: [
            ...MainPageRoutes,
        ]*/
            children: [
                ...LANDING_ROUTES,
                ...AUTH_ROUTES,
            ]
    },
    { path: '**', redirectTo: ''},
];

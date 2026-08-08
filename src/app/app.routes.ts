import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './core/layout/public-layout/public-layout.component';
import { PrivateLayoutComponent } from './core/layout/private-layout/private-layout.component';
import { guestGuard } from './core/auth/guest.guard';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
    {
        path: '',
        component: PublicLayoutComponent,
        canActivate: [guestGuard],
        children: [
            {
                path: '',
                loadChildren: () =>
                  import('./features/landing/landing.routes').then(m => m.LANDING_ROUTES),
              },
              {
                path: 'auth',
                loadChildren: () =>
                  import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
              },
        ]
    },
    {
        path: '',
        component: PrivateLayoutComponent,
        canActivate: [authGuard],
            children: [
                {
                    path: 'home',
                    loadChildren: () =>
                      import('./features/home/home.routes').then(m => m.HOME_ROUTES),
                  },
                  {
                    path: 'admin-recipes',
                    loadChildren: () =>
                        import('./features/admin-recipes/admin-recipes.routes').then(m => m.ADMINRECIPES_ROUTES),
                  },
                  // recipes, profile, etc.
            ]
    },
    { path: '**', redirectTo: ''},
];

/** Home route tests protect private-layout ownership and canonical encoded destinations. */
import { TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter } from '@angular/router';

import { routes } from '@app/app.routes';
import { authGuard } from '@app/core/auth/auth.guard';
import { PrivateLayoutComponent } from '@app/core/layout/private-layout/private-layout.component';
import { HomePageComponent } from './home.page';
import { HOME_ROUTES } from './home.routes';

describe('Home routes', () => {
  it('lazy-loads Home only beneath the authenticated private layout', async () => {
    const privateRoute = routes.find(route => route.component === PrivateLayoutComponent);
    const homeRoute = privateRoute?.children?.find(route => route.path === 'home');

    expect(privateRoute?.canActivate).toContain(authGuard);
    expect(routes.filter(route => route.path === 'home')).toHaveLength(0);
    expect(homeRoute?.loadChildren).toBeTypeOf('function');
    expect(await homeRoute?.loadChildren?.() as Routes).toBe(HOME_ROUTES);
    expect(HOME_ROUTES).toEqual([
      expect.objectContaining({ path: '', title: 'Home', component: HomePageComponent }),
    ]);
  });

  it('lets Angular encode a Home search query for the canonical Recipes URL', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const router = TestBed.inject(Router);
    const tree = router.createUrlTree(['/recipes'], {
      queryParams: { search: 'rice & chicken' },
    });

    expect(router.serializeUrl(tree)).toBe('/recipes?search=rice%20%26%20chicken');
  });
});

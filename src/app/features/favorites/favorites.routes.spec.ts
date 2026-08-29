/** Favorites route tests protect lazy private-tree placement and the canonical feature page. */
import { authGuard } from '@app/core/auth/auth.guard';
import { PrivateLayoutComponent } from '@app/core/layout/private-layout/private-layout.component';
import { routes } from '@app/app.routes';
import { FavoritesPageComponent } from './favorites.page';
import { FAVORITES_ROUTES } from './favorites.routes';

describe('Favorites routes', () => {
  it('maps the feature root to the Favorites page', () => {
    expect(FAVORITES_ROUTES).toEqual([
      expect.objectContaining({ path: '', component: FavoritesPageComponent }),
    ]);
  });

  it('lazy-loads favorites only beneath the authenticated private layout', () => {
    const privateRoute = routes.find(route => route.component === PrivateLayoutComponent);
    const favoritesRoute = privateRoute?.children?.find(route => route.path === 'favorites');

    expect(privateRoute?.canActivate).toContain(authGuard);
    expect(favoritesRoute?.loadChildren).toBeTypeOf('function');
    expect(routes.filter(route => route.path === 'favorites')).toHaveLength(0);
  });
});

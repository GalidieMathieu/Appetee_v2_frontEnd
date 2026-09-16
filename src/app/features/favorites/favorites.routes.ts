/** Lazy Favorites route loaded only beneath the application's authenticated private route tree. */
import { Routes } from '@angular/router';

import { FavoritesPageComponent } from './favorites.page';

export const FAVORITES_ROUTES: Routes = [
  {
    path: '',
    title: 'Favorite Recipes',
    component: FavoritesPageComponent,
  },
];

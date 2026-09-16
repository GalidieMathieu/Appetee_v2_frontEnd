/** Authenticated Home feature route mapped beneath the root private-layout route. */
import { Routes } from '@angular/router';
import { HomePageComponent } from './home.page';

export const HOME_ROUTES: Routes = [
  { path: '', title: 'Home', component: HomePageComponent },
];

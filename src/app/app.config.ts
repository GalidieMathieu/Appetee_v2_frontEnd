import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { apiErrorInterceptor } from './core/api/api-error.interceptor';

import { routes } from './app.routes';

import { SESSION_RESETTERS } from './core/session/session-reset.token';

import { DietsStore } from './core/shared/data-access/diets/diets.store';
import { IngredientsStore } from './core/shared/data-access/ingredients/ingredients.store';
import { AuthStore } from './core/auth/data-access/auth.store';
import { authInterceptor } from './core/auth/auth.interceptor';
import { UserStore } from './core/shared/data-access/user/user.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor,apiErrorInterceptor])
    ),
    // Register stores for resetAll()
    //{ provide: SESSION_RESETTERS, useExisting: RecipesStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: DietsStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: IngredientsStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: AuthStore, multi: true },
    { provide: SESSION_RESETTERS, useExisting: UserStore, multi: true },
  ]
};

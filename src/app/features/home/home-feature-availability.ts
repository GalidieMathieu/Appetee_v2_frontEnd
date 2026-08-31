/**
 * Frontend route-availability boundary for Home actions owned by dependent features.
 * Defaults mirror routes registered in this frontend; they grant no backend capability.
 */
import { InjectionToken } from '@angular/core';

export interface HomeFeatureAvailability {
  readonly favoritesRoute: boolean;
  readonly mealPlanRoute: boolean;
}

export const HOME_FEATURE_AVAILABILITY = new InjectionToken<HomeFeatureAvailability>(
  'HOME_FEATURE_AVAILABILITY',
  {
    factory: () => ({
      favoritesRoute: true,
      mealPlanRoute: false,
    }),
  }
);

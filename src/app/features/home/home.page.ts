/**
 * Authenticated Home composition for independent live recipe previews and route actions.
 * Query state is delegated to HomeFacade while canonical cards retain shared behavior.
 */
import { AsyncPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

import { UserFacade } from '@app/core/shared/data-access/user/user.facade';
import { RecipeListSectionComponent } from '@app/core/shared/ui/recipe-list-section/recipe-list-section.component';
import { RecipeSearchBarComponent } from '@app/core/shared/ui/recipe-search-bar/recipe-search-bar.component';
import { MealPlanEmptyStateComponent } from './components/meal-plan-empty-state/meal-plan-empty-state.component';
import { HOME_FEATURE_AVAILABILITY } from './home-feature-availability';
import { HomeFacade } from './state/home.facade';

@Component({
  selector: 'app-home-page',
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
  standalone: true,
  imports: [
    AsyncPipe,
    MatIconModule,
    MealPlanEmptyStateComponent,
    RecipeListSectionComponent,
    RecipeSearchBarComponent,
  ],
})
export class HomePageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly userFacade = inject(UserFacade);
  private readonly homeFacade = inject(HomeFacade);
  private readonly featureAvailability = inject(HOME_FEATURE_AVAILABILITY);

  protected readonly username$ = this.userFacade.username$;
  protected readonly discoverRecipes = this.homeFacade.discoverRecipes;
  protected readonly favoriteRecipes = this.homeFacade.favoriteRecipes;
  protected readonly isDiscoverLoading = this.homeFacade.isDiscoverLoading;
  protected readonly isDiscoverLoaded = this.homeFacade.isDiscoverLoaded;
  protected readonly discoverError = this.homeFacade.discoverError;
  protected readonly isFavoritesLoading = this.homeFacade.isFavoritesLoading;
  protected readonly isFavoritesLoaded = this.homeFacade.isFavoritesLoaded;
  protected readonly favoritesError = this.homeFacade.favoritesError;
  protected readonly favoritesRouteAvailable = this.featureAvailability.favoritesRoute;
  protected readonly mealPlanRouteAvailable = this.featureAvailability.mealPlanRoute;

  ngOnInit(): void {
    this.homeFacade.initialize();
  }

  /** Routes normalized non-empty intent through Angular query params; Home never runs discovery. */
  protected onSearchSubmitted(query: string): void {
    if (!query) return;
    void this.router.navigate(['/recipes'], { queryParams: { search: query } });
  }

  protected onDiscoverViewAll(): void {
    void this.router.navigate(['/recipes']);
  }

  protected onFavoritesViewAll(): void {
    if (!this.favoritesRouteAvailable) return;
    void this.router.navigate(['/favorites']);
  }

  protected retryDiscover(): void {
    this.homeFacade.retryDiscover();
  }

  protected retryFavorites(): void {
    this.homeFacade.retryFavorites();
  }

  protected onMealPlanAction(): void {
    if (!this.mealPlanRouteAvailable) return;
    void this.router.navigate(['/meal-plan']);
  }

  protected onExploreRecipes(): void {
    void this.router.navigate(['/recipes']);
  }
}

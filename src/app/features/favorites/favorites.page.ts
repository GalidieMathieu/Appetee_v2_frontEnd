/**
 * Authenticated Favorites page shell for list request states and shared Recipe Card rendering.
 * All Preview and favorite interactions continue through the shared Recipe Experience.
 */
import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { RecipeCardGridComponent } from '@app/core/shared/ui/recipe-card-grid/recipe-card-grid.component';
import { FavoritesFacade } from './state/favorites.facade';

@Component({
  selector: 'app-favorites-page',
  standalone: true,
  imports: [MatIconModule, RecipeCardGridComponent, RouterLink],
  templateUrl: './favorites.page.html',
  styleUrl: './favorites.page.scss',
})
export class FavoritesPageComponent implements OnInit {
  private readonly facade = inject(FavoritesFacade);

  protected readonly recipes = this.facade.recipes;
  protected readonly isLoading = this.facade.isLoading;
  protected readonly isLoaded = this.facade.isLoaded;
  protected readonly error = this.facade.error;

  ngOnInit(): void {
    this.facade.loadIfNeeded();
  }

  protected retry(): void {
    this.facade.retry();
  }
}

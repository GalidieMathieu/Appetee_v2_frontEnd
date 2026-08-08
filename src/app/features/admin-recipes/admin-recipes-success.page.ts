import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { defaultIfEmpty, finalize } from 'rxjs';

import {
  RecipeBadge,
  RecipeDetailDto,
  RecipeSummary,
} from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';

function isRecipeSummary(value: unknown): value is RecipeSummary {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const summary = value as Partial<RecipeSummary>;
  return Number.isInteger(summary.id)
    && typeof summary.name === 'string'
    && Number.isFinite(summary.prepTimeMinutes)
    && Number.isFinite(summary.servings)
    && typeof summary.difficulty === 'string';
}

function toRecipeSummary(detail: RecipeDetailDto): RecipeSummary {
  const { instructions, ingredients, ...summary } = detail;

  return {
    ...summary,
    ingredients: ingredients.map(item => ({
      id: item.ingredient.id,
      name: item.ingredient.name,
    })),
  };
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './admin-recipes-success.page.html',
  styleUrl: './admin-recipes-success.page.scss',
})
export class AdminRecipesSuccessPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recipesFacade = inject(RecipesFacade);

  protected readonly copy = {
    hero: {
      eyebrow: 'Recipe Saved',
      title: 'Recipe created successfully',
    },
    actions: {
      createAnother: 'Create Another Recipe',
      modifyCurrent: 'Modify Current Recipe',
    },
    summary: {
      emptyImage: 'No image uploaded',
    },
    stats: {
      calories: 'Calories',
      protein: 'Protein',
      carbs: 'Carbs',
      costPerServing: 'Cost / Serving',
      pendingPrices: 'Pending prices',
      caloriesUnit: 'kcal',
      gramsUnit: 'g',
    },
    recap: {
      title: 'Recipe Recap',
      description: 'These are the linked ingredients returned by the backend.',
    },
    loading: {
      loadingIcon: 'hourglass_top',
      idleIcon: 'restaurant_menu',
      loadingTitle: 'Loading recipe recap',
      idleTitle: 'Preparing recipe summary',
      loadingDescription: 'We are loading the recipe information so the recap stays accurate.',
      idleDescription: 'We are getting the latest recipe summary ready.',
    },
    units: {
      prepMinutesSuffix: 'min prep',
    },
  } as const;
  protected readonly currencyCode = 'USD';
  readonly recipeSummary = signal<RecipeSummary | null>(this.getRecipeSummaryFromNavigation());
  readonly isLoading = signal(false);
  readonly badgeLabels = computed(() =>
    (this.recipeSummary()?.badges ?? []).map(badge => this.formatBadgeLabel(badge))
  );
  readonly loadingContent = computed(() =>
    this.isLoading()
      ? {
          icon: this.copy.loading.loadingIcon,
          title: this.copy.loading.loadingTitle,
          description: this.copy.loading.loadingDescription,
        }
      : {
          icon: this.copy.loading.idleIcon,
          title: this.copy.loading.idleTitle,
          description: this.copy.loading.idleDescription,
        }
  );

  ngOnInit(): void {
    const routeRecipeId = this.getRouteRecipeId();
    if (routeRecipeId === null) {
      this.redirectToCreate();
      return;
    }

    if (this.recipeSummary()?.id === routeRecipeId) {
      return;
    }

    this.isLoading.set(true);

    this.recipesFacade.getRecipeWithDetails(routeRecipeId).pipe(
      defaultIfEmpty(null),
      finalize(() => this.isLoading.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(detail => {
      if (!detail) {
        this.redirectToCreate();
        return;
      }

      this.recipeSummary.set(toRecipeSummary(detail));
    });
  }

  protected formatBadgeLabel(badge: RecipeBadge): string {
    switch (badge) {
      case 'freezer-friendly':
        return 'Freezer-friendly';
      case 'budget-focused':
        return 'Budget-focused';
      case 'high-protein':
        return 'High-protein';
    }
  }

  protected buildHeroDescription(recipeName: string): string {
    return `"${recipeName}" is ready. You can jump into another recipe or open this one in edit mode.`;
  }

  protected buildIngredientCountText(count: number): string {
    return `${count} ingredient${count === 1 ? '' : 's'} linked to this recipe.`;
  }

  protected buildPrepTimeText(prepTimeMinutes: number): string {
    return `${prepTimeMinutes} ${this.copy.units.prepMinutesSuffix}`;
  }

  protected buildServingsText(servings: number): string {
    return `${servings} serving${servings === 1 ? '' : 's'}`;
  }

  private getRouteRecipeId(): number | null {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  private getRecipeSummaryFromNavigation(): RecipeSummary | null {
    const navigationState = this.router.currentNavigation()?.extras.state ?? history.state;
    const candidate = navigationState?.['recipeSummary'];

    return isRecipeSummary(candidate) ? candidate : null;
  }

  private redirectToCreate(): void {
    void this.router.navigate(['/admin-recipes/create'], { replaceUrl: true });
  }
}

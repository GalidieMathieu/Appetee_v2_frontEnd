/**
 * Thin authenticated route container for one Cooking View request and its page-level states.
 * Exit delegates to shared Recipe Experience history orchestration without feature-store coupling.
 */
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';

import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { RecipeCookingModeComponent } from '@app/core/shared/ui/recipe-experience/cooking-mode/recipe-cooking-mode.component';
import { RecipeExperienceFacade } from '@app/core/shared/ui/recipe-experience/recipe-experience.facade';

@Component({
  selector: 'app-recipe-cooking-page',
  standalone: true,
  imports: [MatIconModule, RecipeCookingModeComponent],
  templateUrl: './recipe-cooking.page.html',
  styleUrl: './recipe-cooking.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeCookingPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly recipesFacade = inject(RecipesFacade);
  private readonly recipeExperience = inject(RecipeExperienceFacade);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly recipeId = parseRecipeId(this.route.snapshot.paramMap.get('id'));
  private readonly cacheId = this.recipeId ?? 0;
  protected readonly cookingView = this.recipesFacade.cookingViewFor(this.cacheId);
  protected readonly requestState = this.recipesFacade.cookingViewRequestState(this.cacheId);
  protected readonly hasInvalidRouteId = this.recipeId === null;
  protected readonly hasInvalidCookingData = computed(() => {
    const view = this.cookingView();
    return view !== null
      && (view.baseServings < 1 || view.ingredients.length === 0 || view.steps.length === 0);
  });
  protected readonly isUnavailable = computed(() =>
    this.hasInvalidRouteId
    || this.hasInvalidCookingData()
    || this.requestState().httpStatus === 404
  );

  constructor() {
    this.load();
  }

  protected retry(): void {
    if (this.recipeId === null) return;
    this.recipesFacade.retryCookingView(this.recipeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  protected exitCookingMode(): void {
    this.recipeExperience.exitCookingMode();
  }

  private load(): void {
    if (this.recipeId === null) return;
    this.recipesFacade.getCookingView(this.recipeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
}

/** Accepts only a canonical positive integer route segment and avoids partial numeric parsing. */
function parseRecipeId(value: string | null): number | null {
  if (value === null || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

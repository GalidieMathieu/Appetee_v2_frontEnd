/**
 * Recipe-experience Quick Preview dialog for card-known and lazily fetched Preview fields.
 * The component renders one responsive desktop/mobile experience and can mutate from its passed
 * Card immediately, even when that Card is not part of the Recipe Discovery store.
 */
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewEncapsulation,
  computed,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';

export interface RecipeQuickPreviewData {
  readonly recipeId: number;
  readonly card?: RecipeCardDto;
}

@Component({
  selector: 'app-recipe-quick-preview',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, MatDialogModule, MatIconModule],
  templateUrl: './recipe-quick-preview.component.html',
  styleUrl: './recipe-quick-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class RecipeQuickPreviewComponent {
  protected readonly data = inject<RecipeQuickPreviewData>(MAT_DIALOG_DATA);
  private readonly recipesFacade = inject(RecipesFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject<
    MatDialogRef<RecipeQuickPreviewComponent, void>
  >(MatDialogRef);

  protected readonly preview = this.recipesFacade.previewFor(this.data.recipeId);
  protected readonly currentCard = this.recipesFacade.cardFor(this.data.recipeId);
  protected readonly requestState = this.recipesFacade.previewRequestState(
    this.data.recipeId
  );
  protected readonly favoriteFeedback = computed(() => {
    const feedback = this.recipesFacade.favoriteFeedback();
    return feedback?.recipeId === this.data.recipeId ? feedback.message : null;
  });
  protected readonly isFavoritePending = computed(() =>
    this.recipesFacade.isFavoritePending(this.data.recipeId)
  );
  protected readonly canFavorite = computed(() =>
    this.data.card !== undefined || this.currentCard() !== null || this.preview() !== null
  );
  protected readonly isSaved = computed(() =>
    this.preview()?.isSaved
      ?? this.currentCard()?.isSaved
      ?? this.data.card?.isSaved
      ?? false
  );
  protected readonly imageUrl = computed(() => {
    const preview = this.preview();
    const canonicalUrl = preview
      ? preview.previewImageUrl
      : this.data.card?.cardImageUrl;
    return canonicalUrl ?? 'assets/icons/chef-hat.png';
  });
  protected readonly name = computed(() =>
    this.preview()?.name ?? this.data.card?.name ?? 'Recipe preview'
  );
  protected readonly totalTimeMinutes = computed(() =>
    this.preview()?.totalTimeMinutes ?? this.data.card?.totalTimeMinutes ?? null
  );
  protected readonly caloriesPerServing = computed(() =>
    this.preview()?.caloriesPerServing ?? this.data.card?.caloriesPerServing ?? null
  );
  protected readonly estimatedCostPerServing = computed(() =>
    this.preview()?.estimatedCostPerServing
      ?? this.data.card?.estimatedCostPerServing
      ?? null
  );
  protected readonly badges = computed(() =>
    this.preview()?.badges ?? this.data.card?.badges ?? []
  );
  protected readonly visibleIngredients = computed(() =>
    this.preview()?.ingredients.slice(0, 6) ?? []
  );
  protected readonly remainingIngredientCount = computed(() =>
    Math.max((this.preview()?.ingredients.length ?? 0) - 6, 0)
  );

  constructor() {
    this.loadPreview();
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected retry(): void {
    this.loadPreview();
  }

  protected toggleFavorite(): void {
    if (this.isFavoritePending() || !this.canFavorite()) return;
    this.recipesFacade.toggleFavorite(this.data.recipeId, this.isSaved());
  }

  protected dismissFavoriteFeedback(): void {
    this.recipesFacade.dismissFavoriteFeedback();
  }

  /** Starts or joins the shared same-ID request; cache and request state remain facade-owned. */
  private loadPreview(): void {
    this.recipesFacade.getPreview(this.data.recipeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
}

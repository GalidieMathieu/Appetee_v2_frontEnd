import { CurrencyPipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';

export type RecipeCardImageLoading = 'eager' | 'lazy';

@Component({
  selector: 'app-recipe-card',
  standalone: true,
  templateUrl: './recipe-card.component.html',
  styleUrl: './recipe-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DecimalPipe, MatIconModule],
})
export class RecipeCardComponent implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private resizeObserver: ResizeObserver | null = null;

  @ViewChild('badgeRow') private badgeRow?: ElementRef<HTMLElement>;
  @ViewChild('ingredientRow') private ingredientRow?: ElementRef<HTMLElement>;

  readonly recipe = input.required<RecipeCardDto>();
  readonly imageLoading = input<RecipeCardImageLoading>('lazy');

  readonly recipeSelected = output<number>();
  readonly favoriteSelected = output<number>();

  protected readonly resolvedImageUrl = computed(() =>
    this.recipe().cardImageUrl ?? 'assets/icons/chef-hat.png'
  );
  protected readonly fittingBadgeCount = signal(3);
  protected readonly fittingIngredientCount = signal(3);
  protected readonly candidateBadges = computed(() => this.recipe().badges.slice(0, 3));
  protected readonly candidateFeaturedIngredients = computed(() =>
    [...this.recipe().featuredIngredients]
      .sort((left, right) => left.featuredOrder - right.featuredOrder)
      .slice(0, 3)
  );

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.recalculateVisibleItems();
    if (typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver(() => this.recalculateVisibleItems());
    if (this.badgeRow) this.resizeObserver.observe(this.badgeRow.nativeElement);
    if (this.ingredientRow) this.resizeObserver.observe(this.ingredientRow.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  protected selectRecipe(): void {
    this.recipeSelected.emit(this.recipe().id);
  }

  protected onSelectionKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.selectRecipe();
  }

  protected onFavoriteClick(event: MouseEvent): void {
    event.stopPropagation();
    this.favoriteSelected.emit(this.recipe().id);
  }

  private recalculateVisibleItems(): void {
    if (this.badgeRow) {
      this.fittingBadgeCount.set(this.fittingPrefixCount(this.badgeRow.nativeElement));
    }
    if (this.ingredientRow) {
      this.fittingIngredientCount.set(
        this.fittingPrefixCount(this.ingredientRow.nativeElement)
      );
    }
  }

  private fittingPrefixCount(row: HTMLElement): number {
    const chips = Array.from(row.querySelectorAll<HTMLElement>('[data-fit-chip]'));
    if (chips.length <= 1 || row.clientWidth <= 0) return chips.length;

    const rowStyle = getComputedStyle(row);
    const gap = Number.parseFloat(rowStyle.columnGap || rowStyle.gap) || 0;
    let usedWidth = 0;
    let fittingCount = 0;

    for (const chip of chips) {
      const chipWidth = Math.ceil(chip.scrollWidth);
      const nextWidth = usedWidth + (fittingCount > 0 ? gap : 0) + chipWidth;
      if (fittingCount > 0 && nextWidth > row.clientWidth) break;

      usedWidth = nextWidth;
      fittingCount += 1;
    }

    return Math.max(1, fittingCount);
  }
}

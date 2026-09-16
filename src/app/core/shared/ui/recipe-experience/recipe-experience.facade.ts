/**
 * Shared Recipe Experience orchestration for Preview, Cooking entry, and trusted history return.
 * Only transient URL/scroll context lives here; recipe data remains in shared data-access stores.
 */
import { DOCUMENT, Location, ViewportScroller } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter, take } from 'rxjs';

import { RecipesFacade } from '@app/core/shared/data-access/recipes/recipe.facade';
import { RecipeCardDto } from '@app/core/shared/data-access/recipes/recipe.model';
import { ResettableStore } from '@app/core/shared/utils/resettable-store';

import {
  RecipeQuickPreviewComponent,
  RecipeQuickPreviewData,
} from './recipe-quick-preview/recipe-quick-preview.component';

export interface RecipeReturnContext {
  readonly url: string;
  readonly scrollY: number;
}

@Injectable({ providedIn: 'root' })
export class RecipeExperienceFacade implements ResettableStore {
  private readonly recipes = inject(RecipesFacade);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly viewportScroller = inject(ViewportScroller);
  private readonly document = inject(DOCUMENT);

  private activePreview: MatDialogRef<RecipeQuickPreviewComponent, void> | null = null;
  private returnContext: RecipeReturnContext | null = null;
  private returnNavigationSubscription: Subscription | null = null;
  private firstScrollFrame: number | null = null;
  private secondScrollFrame: number | null = null;

  /** Opens one responsive dialog with known Card fields available before lazy Preview data. */
  openPreview(recipe: RecipeCardDto): void {
    const preview = this.dialog.open<RecipeQuickPreviewComponent, RecipeQuickPreviewData, void>(
      RecipeQuickPreviewComponent,
      {
        data: {
          recipeId: recipe.id,
          card: recipe,
          startCooking: () => this.startCooking(recipe.id),
        },
        panelClass: 'recipe-quick-preview-panel',
        width: 'min(45rem, 100vw)',
        maxWidth: '100vw',
        maxHeight: '100dvh',
        autoFocus: '.recipe-quick-preview__close',
        restoreFocus: true,
        ariaLabelledBy: 'recipe-quick-preview-title',
      }
    );

    this.activePreview = preview;
    preview.afterClosed().pipe(take(1)).subscribe(() => {
      if (this.activePreview === preview) this.activePreview = null;
    });
  }

  /** Captures the exact trusted origin before closing Preview and creating one history entry. */
  startCooking(recipeId: number): void {
    if (!Number.isSafeInteger(recipeId) || recipeId < 1) return;

    this.disposeReturnListener();
    this.cancelScheduledScroll();
    const url = this.router.url;
    const context = isInternalUrl(url)
      ? { url, scrollY: this.currentScrollY() }
      : null;
    this.returnContext = context;
    if (context !== null) this.armReturnRestoration(context);

    const preview = this.activePreview;
    this.activePreview = null;
    preview?.close();

    void this.router.navigateByUrl(`/recipes/${recipeId}/cooking`)
      .then(navigated => {
        if (!navigated && this.returnContext === context) {
          this.returnContext = null;
          this.disposeReturnListener();
        }
      })
      .catch(() => {
        if (this.returnContext === context) {
          this.returnContext = null;
          this.disposeReturnListener();
        }
      });
  }

  /** Returns through browser history when trusted context exists, otherwise uses the safe Recipes route. */
  exitCookingMode(): void {
    const context = this.returnContext;
    this.returnContext = null;

    if (context === null || !isInternalUrl(context.url)) {
      this.disposeReturnListener();
      this.cancelScheduledScroll();
      void this.router.navigateByUrl('/recipes');
      return;
    }

    if (this.returnNavigationSubscription === null) this.armReturnRestoration(context);
    this.location.back();
  }

  toggleFavorite(recipeId: number, currentSavedState: boolean): void {
    this.recipes.toggleFavorite(recipeId, currentSavedState);
  }

  favoriteSavedState(recipeId: number, fallback: boolean): boolean {
    return this.recipes.favoriteSavedState(recipeId, fallback);
  }

  isFavoritePending(recipeId: number): boolean {
    return this.recipes.isFavoritePending(recipeId);
  }

  favoriteFeedbackFor(recipeId: number): string | null {
    const feedback = this.recipes.favoriteFeedback();
    return feedback?.recipeId === recipeId ? feedback.message : null;
  }

  /** Clears identity-scoped transient navigation state and any pending UI work. */
  reset(): void {
    this.returnContext = null;
    this.disposeReturnListener();
    this.cancelScheduledScroll();
    const preview = this.activePreview;
    this.activePreview = null;
    preview?.close();
  }

  private currentScrollY(): number {
    const viewportY = this.viewportScroller.getScrollPosition()[1];
    const layoutY = this.document.querySelector<HTMLElement>('.private-layout_main')?.scrollTop ?? 0;
    return Math.max(normalizeScrollY(viewportY), normalizeScrollY(layoutY));
  }

  private scheduleScrollRestore(scrollY: number): void {
    const view = this.document.defaultView;
    if (view === null || typeof view.requestAnimationFrame !== 'function') {
      this.restoreScroll(scrollY);
      return;
    }

    this.firstScrollFrame = view.requestAnimationFrame(() => {
      this.firstScrollFrame = null;
      this.secondScrollFrame = view.requestAnimationFrame(() => {
        this.secondScrollFrame = null;
        this.restoreScroll(scrollY);
      });
    });
  }

  private restoreScroll(scrollY: number): void {
    const safeScrollY = normalizeScrollY(scrollY);
    this.viewportScroller.scrollToPosition([0, safeScrollY]);

    const layout = this.document.querySelector<HTMLElement>('.private-layout_main');
    if (layout === null) return;
    if (typeof layout.scrollTo === 'function') {
      layout.scrollTo({ left: 0, top: safeScrollY });
    } else {
      layout.scrollTop = safeScrollY;
    }
  }

  /** Watches only for the exact origin, covering both the Exit action and native browser Back. */
  private armReturnRestoration(context: RecipeReturnContext): void {
    this.returnNavigationSubscription = this.router.events.pipe(
      filter((event): event is NavigationEnd =>
        event instanceof NavigationEnd && event.urlAfterRedirects === context.url
      ),
      take(1)
    ).subscribe(() => {
      this.returnNavigationSubscription = null;
      if (this.returnContext === context) this.returnContext = null;
      this.scheduleScrollRestore(context.scrollY);
    });
  }

  private disposeReturnListener(): void {
    this.returnNavigationSubscription?.unsubscribe();
    this.returnNavigationSubscription = null;
  }

  private cancelScheduledScroll(): void {
    const view = this.document.defaultView;
    if (view !== null && typeof view.cancelAnimationFrame === 'function') {
      if (this.firstScrollFrame !== null) view.cancelAnimationFrame(this.firstScrollFrame);
      if (this.secondScrollFrame !== null) view.cancelAnimationFrame(this.secondScrollFrame);
    }
    this.firstScrollFrame = null;
    this.secondScrollFrame = null;
  }

}

/** Rejects protocol-relative, slash-confused, and control-character return targets. */
function isInternalUrl(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//') && !/[\\\u0000-\u001f\u007f]/.test(url);
}

function normalizeScrollY(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

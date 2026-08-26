import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { RecipeCardComponent } from '@app/core/shared/ui/recipe-card/recipe-card.component';
import { RecipeDiscoveryFacade } from '../state/recipe-discovery.facade';

@Component({
  selector: 'app-recipes-list',
  templateUrl: './recipesList.page.html',
  styleUrls: ['./recipesList.page.scss'],
  standalone: true,
  imports: [MatIconModule, RecipeCardComponent],
})
export class RecipesListComponent implements OnInit, OnDestroy {
  private readonly discoveryFacade = inject(RecipeDiscoveryFacade);
  private readonly platformId = inject(PLATFORM_ID);
  private loadMoreObserver: IntersectionObserver | null = null;

  protected readonly recipes = this.discoveryFacade.cards;
  protected readonly hasMore = this.discoveryFacade.hasMore;
  protected readonly isInitialLoading = this.discoveryFacade.isInitialLoading;
  protected readonly initialError = this.discoveryFacade.initialError;
  protected readonly isLoadingMore = this.discoveryFacade.isLoadingMore;
  protected readonly loadMoreError = this.discoveryFacade.loadMoreError;
  protected readonly skeletonCards = Array.from({ length: 8 });

  @ViewChild('loadMoreSentinel')
  set loadMoreSentinel(element: ElementRef<HTMLElement> | undefined) {
    this.loadMoreObserver?.disconnect();
    this.loadMoreObserver = null;

    if (
      !element
      || !isPlatformBrowser(this.platformId)
      || typeof IntersectionObserver === 'undefined'
    ) {
      return;
    }

    this.loadMoreObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        this.discoveryFacade.loadNextPage();
      }
    }, { rootMargin: '240px 0px' });
    this.loadMoreObserver.observe(element.nativeElement);
  }

  ngOnInit(): void {
    this.discoveryFacade.initialize();
  }

  ngOnDestroy(): void {
    this.loadMoreObserver?.disconnect();
  }

  protected retryInitial(): void {
    this.discoveryFacade.retryInitial();
  }

  protected loadNextPage(): void {
    this.discoveryFacade.loadNextPage();
  }

  protected retryLoadMore(): void {
    this.discoveryFacade.retryLoadMore();
  }
}

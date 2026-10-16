import { DestroyRef, Injectable, OnDestroy, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { NutritionPlansStore } from '@app/core/shared/data-access/meal-plan/nutrition-plans.store';
import { PlanCreateChoiceDialog } from '../nutrition-plans/plan-create-choice.dialog';

/** Feature-owned entry/chooser coordination; never creates plans or owns API data. */
@Injectable()
export class NutritionPlanEntryFacade implements OnDestroy {
  private readonly router = inject(Router);
  private readonly dialogs = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly plans = inject(NutritionPlansStore);
  private choice: MatDialogRef<PlanCreateChoiceDialog, 'easy' | 'intermediate'> | null = null;

  readonly atCap = computed(() => this.plans.loaded() && this.plans.plans().length >= 50);
  readonly showHeader = toSignal(this.router.events.pipe(
    filter(event => event instanceof NavigationEnd),
    map(() => this.router.url),
    startWith(this.router.url),
    map(url => {
      const path = url.split(/[?#]/)[0];
      return path === '/' || path === '/meal-plan' || path === '/meal-plan/planner' || path === '/meal-plan/nutrition-plans';
    }),
  ), { initialValue: true });

  openCreate(): void {
    if (this.choice || this.atCap()) return;
    this.choice = this.dialogs.open(PlanCreateChoiceDialog, {
      width: '40rem', maxWidth: 'calc(100vw - 2rem)',
      ariaLabelledBy: 'plan-choice-title', ariaDescribedBy: 'plan-choice-help',
      autoFocus: 'first-tabbable', restoreFocus: true,
    });
    this.choice.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(mode => {
      this.choice = null;
      if (!mode || this.atCap()) return;
      void this.router.navigateByUrl(mode === 'easy'
        ? '/meal-plan/nutrition-plans/create/easy'
        : '/meal-plan/nutrition-plans/create/intermediate/profile');
    });
  }

  ngOnDestroy(): void { this.choice?.close(); }
}

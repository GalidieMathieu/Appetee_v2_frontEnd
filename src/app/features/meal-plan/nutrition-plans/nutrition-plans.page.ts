import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, afterRenderEffect, effect, inject, viewChild } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { NutritionPlansPageFacade } from '../state/nutrition-plans-page.facade';
import { NutritionPlanCardComponent } from './nutrition-plan-card.component';

@Component({
  selector: 'app-nutrition-plans-page', standalone: true,
  imports: [NutritionPlanCardComponent, MatDialogModule],
  templateUrl: './nutrition-plans.page.html', styleUrl: './nutrition-plans.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NutritionPlansPage implements OnDestroy {
  readonly vm = inject(NutritionPlansPageFacade);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  private readonly restoreCreateFocus = inject(Router).currentNavigation()?.extras.state?.['focusCreatePlan'] === true;
  private readonly restorePlanId = inject(Router).currentNavigation()?.extras.state?.['focusPlanId'];
  private readonly content: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');
  private readonly dialogError = viewChild<ElementRef<HTMLElement>>('dialogError');

  constructor() {
    this.vm.enter();
    let editFocusRestored = false;
    afterRenderEffect(() => {
      if (!editFocusRestored && typeof this.restorePlanId === 'number' && this.vm.loaded() && !this.vm.loading()) {
        const button = this.content.nativeElement.querySelector<HTMLButtonElement>(`[data-edit-plan-id="${this.restorePlanId}"]`);
        (button && !button.disabled ? button : this.heading()?.nativeElement)?.focus();
        editFocusRestored = true;
      }
    });
    effect(() => {
      if (this.vm.focusHeading() > 0) {
        const create = this.restoreCreateFocus
          ? this.content.nativeElement.closest('app-meal-plan-shell')?.querySelector<HTMLButtonElement>('#meal-plan-create')
          : null;
        (create && !create.disabled ? create : this.heading()?.nativeElement)?.focus();
      }
    });
    effect(() => {
      if (this.vm.error()) {
        (this.vm.deleteId() === null ? this.errorSummary() : this.dialogError())?.nativeElement.focus();
      }
    });
  }

  @HostListener('window:focus') onFocus(): void { this.vm.onWindowFocus(); }
  ngOnDestroy(): void { this.vm.leave(); }
}

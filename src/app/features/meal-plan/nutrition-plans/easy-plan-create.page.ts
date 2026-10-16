import { FieldErrorLinkDirective } from '../planner/field-error-link.directive';
import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, effect, inject, viewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NutritionPlanFlowFacade } from '../state/nutrition-plan-flow.facade';

@Component({
  selector: 'app-easy-plan-create-page', standalone: true, imports: [FieldErrorLinkDirective, ReactiveFormsModule],
  templateUrl: './easy-plan-create.page.html', styleUrl: './easy-plan-create.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EasyPlanCreatePage implements OnDestroy {
  readonly vm = inject(NutritionPlanFlowFacade);
  readonly mealCounts = [1, 2, 3, 4, 5, 6, 7, 8];
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  private readonly summary = viewChild<ElementRef<HTMLElement>>('summary');

  constructor() {
    this.vm.enter();
    effect(() => { this.heading()?.nativeElement.focus(); });
    effect(() => { if (this.vm.error()) this.summary()?.nativeElement.focus(); });
  }
  ngOnDestroy(): void { this.vm.leave(); }
}

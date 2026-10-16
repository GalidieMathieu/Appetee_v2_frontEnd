import { FieldErrorLinkDirective } from '../planner/field-error-link.directive';
import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, effect, inject, viewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NutritionTargetsComponent } from './nutrition-targets.component';
import { ActivatedRoute } from '@angular/router';
import { NutritionPlanFlowFacade } from '../state/nutrition-plan-flow.facade';
import { ProfileStepComponent } from './steps/profile-step.component';
import { GoalStepComponent } from './steps/goal-step.component';
import { ActivityStepComponent } from './steps/activity-step.component';
import { MealStructureStepComponent } from './steps/meal-structure-step.component';
import { ReviewStepComponent } from './steps/review-step.component';
import { mealPlanWarningText } from '../models/meal-plan-display.model';
@Component({ selector: 'app-nutrition-plan-edit', standalone: true, imports: [FieldErrorLinkDirective, ReactiveFormsModule, ProfileStepComponent, GoalStepComponent, ActivityStepComponent, MealStructureStepComponent, ReviewStepComponent, MatIconModule, NutritionTargetsComponent], templateUrl: './nutrition-plan-edit.page.html', styleUrl: './nutrition-plan-edit.page.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class NutritionPlanEditPage implements OnDestroy {
    readonly vm = inject(NutritionPlanFlowFacade);
    readonly warningText = mealPlanWarningText;
    private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
    private readonly summary = viewChild<ElementRef<HTMLElement>>('summary');
    constructor() {
        this.vm.bindEditRoute(inject(ActivatedRoute));
        effect(() => { this.heading()?.nativeElement.focus(); });
        effect(() => { if (this.vm.error() || this.vm.detailQuery()?.error)
            this.summary()?.nativeElement.focus(); });
    }
    ngOnDestroy(): void { this.vm.leave(); }
}

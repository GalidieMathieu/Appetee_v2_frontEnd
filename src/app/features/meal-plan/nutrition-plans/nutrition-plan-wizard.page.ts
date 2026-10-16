import { FieldErrorLinkDirective } from '../planner/field-error-link.directive';
import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, effect, inject, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NutritionPlanFlowFacade } from '../state/nutrition-plan-flow.facade';
import { ProfileStepComponent } from './steps/profile-step.component';
import { GoalStepComponent } from './steps/goal-step.component';
import { ActivityStepComponent } from './steps/activity-step.component';
import { MealStructureStepComponent } from './steps/meal-structure-step.component';
import { ReviewStepComponent } from './steps/review-step.component';
@Component({ selector: 'app-nutrition-plan-wizard', standalone: true, imports: [FieldErrorLinkDirective, ProfileStepComponent, GoalStepComponent, ActivityStepComponent, MealStructureStepComponent, ReviewStepComponent], templateUrl: './nutrition-plan-wizard.page.html', styleUrl: './nutrition-plan-wizard.page.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class NutritionPlanWizardPage implements OnDestroy {
    readonly vm = inject(NutritionPlanFlowFacade);
    readonly stepLabels = { profile: 'Profile', goal: 'Goal', activity: 'Activity', 'meal-structure': 'Meal Structure', review: 'Review' };
    private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
    private readonly summary = viewChild<ElementRef<HTMLElement>>('summary');
    constructor() {
        this.vm.startWizard();
        this.vm.bindWizardRoute(inject(ActivatedRoute));
        effect(() => { this.vm.draftState.step(); this.heading()?.nativeElement.focus(); });
        effect(() => { if (this.vm.error() || this.vm.query().error || this.vm.profileError())
            this.summary()?.nativeElement.focus(); });
    }
    ngOnDestroy(): void { this.vm.leave(); }
}

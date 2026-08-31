/** Home-specific onboarding shown until the owning Manual Meal Planning feature is available. */
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-meal-plan-empty-state',
  standalone: true,
  templateUrl: './meal-plan-empty-state.component.html',
  styleUrl: './meal-plan-empty-state.component.scss',
})
export class MealPlanEmptyStateComponent {
  readonly actionDisabled = input(true);
  readonly actionTriggered = output<void>();

  protected triggerAction(): void {
    if (!this.actionDisabled()) this.actionTriggered.emit();
  }
}

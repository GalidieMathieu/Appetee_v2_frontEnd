import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ActivityLevel, NutritionGoal, NutritionPlanSummaryDto } from '@app/core/shared/data-access/meal-plan/nutrition-plan.model';

@Component({
  selector: 'app-nutrition-plan-card', standalone: true,
  imports: [DecimalPipe, MatIconModule, MatMenuModule],
  templateUrl: './nutrition-plan-card.component.html', styleUrl: './nutrition-plan-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NutritionPlanCardComponent {
  readonly plan = input.required<NutritionPlanSummaryDto>();
  readonly current = input(false);
  readonly disabled = input(false);
  readonly duplicateDisabled = input(false);
  readonly pending = input<'use' | 'duplicate' | 'delete' | null>(null);
  readonly usePlan = output<void>();
  readonly editPlan = output<void>();
  readonly duplicatePlan = output<void>();
  readonly deletePlan = output<void>();
  readonly goalIcons: Record<NutritionGoal, string> = { performance: 'fitness_center', maintain: 'eco', fatLoss: 'local_fire_department', muscleGain: 'favorite_border', weightGain: 'north', recomposition: 'track_changes' };
  readonly goalLabels: Record<NutritionGoal, string> = {
    performance: 'Performance', maintain: 'Maintain weight', fatLoss: 'Fat loss',
    muscleGain: 'Muscle gain', weightGain: 'Weight gain', recomposition: 'Recomposition',
  };
  readonly activityLabels: Record<ActivityLevel, string> = {
    inactive: 'Inactive', lowActive: 'Low active', active: 'Active', veryActive: 'Very active',
  };
}

import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NutrientsDto } from '@app/core/shared/data-access/meal-plan/meal-plan.model';

/** Presentation of authoritative targets only; never derives nutrition or percentages. */
@Component({
  selector: 'app-nutrition-targets', standalone: true, imports: [DecimalPipe],
  templateUrl: './nutrition-targets.component.html', styleUrl: './nutrition-targets.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NutritionTargetsComponent {
  readonly targets = input<NutrientsDto | null>(null);
  readonly sidebar = input(false);
  readonly metrics = computed(() => [
    { label: 'Calories', value: this.targets()?.caloriesKcal, unit: 'kcal' },
    { label: 'Protein', value: this.targets()?.proteinG, unit: 'g' },
    { label: 'Carbs', value: this.targets()?.carbsG, unit: 'g' },
    { label: 'Fat', value: this.targets()?.fatG, unit: 'g' },
  ]);
}

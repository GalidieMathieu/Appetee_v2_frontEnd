import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NutrientsDto } from '@app/core/shared/data-access/meal-plan/meal-plan.model';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
@Component({ selector: 'app-nutrition-summary', standalone: true, imports: [DecimalPipe, MatIconModule], templateUrl: './nutrition-summary.component.html', styleUrl: './nutrition-summary.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class NutritionSummaryComponent {
    readonly totals = input.required<NutrientsDto>();
    readonly targets = input<NutrientsDto | null>(null);
    readonly remaining = input<NutrientsDto | null>(null);
    readonly showNoTargetsNotice = input(true);
    readonly presentation = input<'daily' | 'inline' | 'total'>('daily');
    readonly metrics = computed(() => [{ key: 'caloriesKcal' as const, label: 'Calories', unit: 'kcal', icon: 'local_fire_department', tone: 'calories' }, { key: 'proteinG' as const, label: 'Protein', unit: 'g', icon: 'fitness_center', tone: 'protein' }, { key: 'carbsG' as const, label: 'Carbs', unit: 'g', icon: 'eco', tone: 'carbs' }, { key: 'fatG' as const, label: 'Fat', unit: 'g', icon: 'water_drop', tone: 'fat' }].map(metric => {
      const total = this.totals()[metric.key], target = this.targets()?.[metric.key] ?? null;
      // Presentation only: authoritative totals and remaining are never calculated here.
      return { ...metric, total, target, remaining: this.remaining()?.[metric.key] ?? null,
        progress: total !== null && target !== null && target > 0 ? Math.min(100, Math.max(0, total / target * 100)) : null };
    }));
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { NutritionPlanEntryFacade } from './state/nutrition-plan-entry.facade';

/** Route-level composition boundary for Meal Plan child flows introduced in later phases. */
@Component({
  selector: 'app-meal-plan-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  providers: [NutritionPlanEntryFacade],
  templateUrl: './meal-plan-shell.page.html',
  styleUrl: './meal-plan-shell.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MealPlanShellPage {
  readonly entry = inject(NutritionPlanEntryFacade);
}

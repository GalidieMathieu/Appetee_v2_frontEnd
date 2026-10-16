import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PlannerMealDto } from '@app/core/shared/data-access/meal-plan/meal-plan.model';
import { QuantityDraft, validMealName, validRecipeQuantity } from '../state/meal-editor-draft.state';
import { NutritionSummaryComponent } from './nutrition-summary.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
@Component({ selector: 'app-meal-editor', standalone: true, imports: [MatIconModule, NutritionSummaryComponent, DragDropModule], templateUrl: './meal-editor.component.html', styleUrl: './meal-editor.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class MealEditorComponent {
  readonly meal = input.required<PlannerMealDto>();
  readonly name = input('');
  readonly quantities = input<Readonly<Record<number, QuantityDraft>>>({});
  readonly scalarReady = input(false);
  readonly actionsReady = input(false);
  readonly fieldErrors = input<Readonly<Partial<Record<string, readonly string[]>>>>({});
  readonly nameChanged = output<string>();
  readonly flush = output<void>();
  readonly addRecipe = output<void>();
  readonly addManual = output<void>();
  readonly editManual = output<number>();
  readonly startOrder = output<void>();
  readonly cancelOrder = output<void>();
  readonly reorder = output<{ from: number; to: number }>();
  readonly quantityChanged = output<{ id: number; value: string }>();
  readonly adjustQuantity = output<{ id: number; delta: number }>();
  readonly removeItem = output<number>();
  readonly validName = validMealName;
  readonly validQuantity = validRecipeQuantity;
}

import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RecipeCardAdvance } from '@app/core/shared/data-access/recipes/recipe.model';
@Component({ selector: 'app-recipe-picker-row', standalone: true, imports: [DecimalPipe, MatIconModule], templateUrl: './recipe-picker-row.component.html', styleUrl: './recipe-picker-row.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class RecipePickerRowComponent {
  readonly recipe = input.required<RecipeCardAdvance>();
  readonly inMeal = input(false);
  readonly disabled = input(false);
  readonly pending = input(false);
  readonly add = output<RecipeCardAdvance>();
  readonly preview = output<RecipeCardAdvance>();
}

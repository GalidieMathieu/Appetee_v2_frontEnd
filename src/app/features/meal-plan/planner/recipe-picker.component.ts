import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RecipeCardAdvance } from '@app/core/shared/data-access/recipes/recipe.model';
import { RecipePickerRowComponent } from './recipe-picker-row.component';
@Component({ selector: 'app-recipe-picker', standalone: true, imports: [RecipePickerRowComponent], templateUrl: './recipe-picker.component.html', styleUrl: './recipe-picker.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class RecipePickerComponent {
  readonly cards = input<readonly RecipeCardAdvance[]>([]);
  readonly search = input('');
  readonly savedOnly = input(false);
  readonly loading = input(false);
  readonly loadingMore = input(false);
  readonly loaded = input(false);
  readonly hasMore = input(false);
  readonly stale = input(false);
  readonly error = input<string | null>(null);
  readonly moreError = input<string | null>(null);
  readonly ready = input(false);
  readonly pendingId = input<number | null>(null);
  readonly inMealIds = input<readonly number[]>([]);
  readonly searchChanged = output<string>();
  readonly searchSubmitted = output<void>();
  readonly tabChanged = output<boolean>();
  readonly refresh = output<void>();
  readonly more = output<void>();
  readonly add = output<RecipeCardAdvance>();
  readonly preview = output<RecipeCardAdvance>();
}

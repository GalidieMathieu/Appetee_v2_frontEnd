import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

import { SignUpWizard } from '../sign-up.wizard';
import { IngredientsFacade } from '@app/core/shared/data-access/ingredients/ingredient.facade';
import { Ingredient } from '@app/core/shared/data-access/ingredients/ingredient.model';
import { MatIconModule } from '@angular/material/icon';
import { startWith } from 'rxjs';

@Component({
  selector: 'app-step-ingredient',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './step-ingredient.page.html',
  styleUrl:'./step-ingredient.page.scss',
})
export class StepIngredientPage implements OnInit {
  readonly wizard = inject(SignUpWizard);
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly loadingPlaceholders = Array.from({ length: 10 }, (_, index) => index);

  private readonly facade = inject(IngredientsFacade);

  readonly ingredients = toSignal(this.facade.ingredients$, {
    initialValue: [] as Ingredient[],
  });

  readonly loadState = toSignal(this.facade.state$, { initialValue: 'idle' });

  readonly search = toSignal(
    this.searchControl.valueChanges.pipe(startWith(this.searchControl.value)),
    { initialValue: this.searchControl.value }
  );

  readonly searchTerm = computed(() => this.search().trim());
  readonly hasSearchTerm = computed(() => this.searchTerm().length > 0);

  readonly filteredIngredients = computed(() => {
    const ingredients = this.ingredients();
    const term = this.search().trim().toLowerCase();

    if (!term) {
      return [];
    }

    return ingredients
      .filter(ingredient => ingredient.name.toLowerCase().startsWith(term))
      .slice(0, 10);
  });

  readonly visibleIngredients = computed(() =>
    this.hasSearchTerm() ? this.filteredIngredients() : this.ingredients()
  );

  readonly isLoading = computed(
    () => this.loadState() === 'loading' && this.ingredients().length === 0
  );

  private readonly selectedIds = toSignal(
    this.wizard.avoid.controls.ingredientIds.valueChanges.pipe(
      startWith(this.wizard.avoid.controls.ingredientIds.value ?? [])
    ),
    { initialValue: this.wizard.avoid.controls.ingredientIds.value ?? [] }
  );

  readonly selectedIngredients = computed(() => {
    const ids = new Set(this.selectedIds() ?? []);
    return this.ingredients().filter(ingredient => ids.has(ingredient.id));
  });

  readonly selectedCount = computed(() => (this.selectedIds() ?? []).length);

  ngOnInit(): void {
    this.facade.loadIfNeeded();
  }

  toggleIngredient(id: number): void {
    const ctrl = this.wizard.avoid.controls.ingredientIds;
    const current = Array.isArray(ctrl.value) ? ctrl.value : [];
    const next = current.includes(id)
      ? current.filter(x => x !== id)
      : [...current, id];

    ctrl.setValue(next);
    ctrl.markAsDirty();
    ctrl.markAsTouched();
  }

  isSelected(id: number): boolean {
    return (this.selectedIds() ?? []).includes(id);
  }
}

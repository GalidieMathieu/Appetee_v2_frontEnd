import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { SignUpWizard } from '../sign-up.wizard';
import { IngredientsFacade } from '@app/core/shared/data-access/ingredients/ingredient.facade';
import { IngredientsStore } from '@app/core/shared/data-access/ingredients/ingredients.store';
import { combineLatest, filter, map, startWith } from 'rxjs';
import { Ingredient } from '@app/core/shared/data-access/ingredients/ingredient.model';

@Component({
  selector: 'app-step-ingredient',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './step-ingredient.page.html',
  styleUrl:'./step-ingredient.page.scss',
})
export class StepIngredientPage implements OnInit {
  readonly wizard = inject(SignUpWizard);
  readonly searchCtrl = new FormControl('', { nonNullable: true });

  private readonly facade = inject(IngredientsFacade);

  readonly ingredients$ = this.facade.ingredients$;
  readonly loadstate$ = this.facade.state$;
  readonly error$ = this.facade.error$;
  

  //we use this for the search purpose
  readonly filteredIngredients$ = combineLatest({
    list: this.ingredients$,
    q: this.searchCtrl.valueChanges.pipe(startWith(this.searchCtrl.value)),
  }).pipe(
    map(({ list, q }) => {
      const query = q.trim().toLowerCase();
      if (!query) return list;
      return list.filter(x => x.name.toLowerCase().includes(query));
    })
  );

  //we use that to see all the selected ID.
  private readonly selectedIds$ =
  this.wizard.avoid.controls.ingredientIds.valueChanges.pipe(
    startWith(this.wizard.avoid.controls.ingredientIds.value ?? [])
  );

  readonly selectedIngredients$ = combineLatest({
    list: this.ingredients$,
    ids: this.selectedIds$,
  }).pipe(
    map(({ list, ids }) => {
      const set = new Set(ids ?? []);
      return (list ?? []).filter(i => set.has(i.id));
    })
  );

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
    const ctrl = this.wizard.avoid.controls.ingredientIds;
    const current = Array.isArray(ctrl.value) ? ctrl.value : [];
    return current.includes(id);
  }

  //to see the number of selected ingredients
  selectedCount(): number {
    const ctrl = this.wizard.avoid.controls.ingredientIds;
    const current = Array.isArray(ctrl.value) ? ctrl.value : [];
    return current.length;
  }



}

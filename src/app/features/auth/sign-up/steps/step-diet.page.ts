import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { SignUpWizard } from '../sign-up.wizard';
import { DietsFacade } from '../../../../core/shared/data-access/diets/diets.facade';
import { DietsStore } from '../../../../core/shared/data-access/diets/diets.store';

@Component({
  selector: 'app-step-diet',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './step-diet.page.html',
  styleUrl:'./step-diet.page.scss',
})
export class StepDietPage implements OnInit {
  readonly wizard = inject(SignUpWizard);

  private readonly facade = inject(DietsFacade);

  readonly diets$ = this.facade.diets$;
  readonly loadstate$ = this.facade.state$; // if you have it
  readonly error$ = this.facade.error$;     // if you have it

  ngOnInit(): void {
    this.facade.loadIfNeeded();
  }

  // toggles an id inside the FormControl<number[]>
  toggleDiet(id: number): void {
    const ctrl = this.wizard.diet.controls.dietIds;
    const current = Array.isArray(ctrl.value) ? ctrl.value : [];
    const next = current.includes(id)
      ? current.filter(x => x !== id)
      : [...current, id];

    ctrl.setValue(next);
    ctrl.markAsDirty();
    ctrl.markAsTouched();
  }

  isSelected(id: number): boolean {
    const ctrl = this.wizard.diet.controls.dietIds;
    const current = Array.isArray(ctrl.value) ? ctrl.value : [];
    return current.includes(id);
  }

}

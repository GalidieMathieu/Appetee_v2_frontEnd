import { Component, effect, inject, input, OnInit, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IngredientAdminDetailRequest,
  IngredientBasisUnit,
} from '../../data-access/ingredients/ingredient.model';
import { readAvifFileSelection } from '../../utils/avif-file-selection/avif-file-selection';

@Component({
  selector: 'app-ingredient-create-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: 'ingredient-creation.component.html',
  styleUrl:'./ingredient-creation.component.scss', 
})
export class IngredientCreateFormComponent implements OnInit {
  //##################### Inputs / Outputs #################
  readonly initialName = input('', {
    transform: (value: string | null | undefined) => value?.trim() ?? '',
  });

  readonly cancelled = output<void>();
  readonly validityChanged = output<boolean>();
  selectedImageName = '';
  readonly basisUnitOptions: IngredientBasisUnit[] = ['g', 'ml'];

  //##################### Ingredient Form #################
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    basis: new FormControl<number>(100,{nonNullable: true,
      validators: [Validators.required, Validators.min(0.01)],
    }),
    basisUnit: new FormControl<IngredientBasisUnit>('g', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    caloriesKcal:new FormControl<number>(100,{nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    price: new FormControl<number | null>(10, {
      validators: [Validators.required, Validators.min(0)],
    }),
    image: new FormControl<File | null>(null, {
      validators: [Validators.required],
    }),
    proteinG: new FormControl<number | null>(null),
    fatG: new FormControl<number | null>(null),
    carbsG: new FormControl<number | null>(null),
    sugarG: new FormControl<number | null>(null),
    fiberG: new FormControl<number | null>(null),
    sodiumMg: new FormControl<number | null>(null),
    vitaminCMg: new FormControl<number | null>(null),
    ironMg: new FormControl<number | null>(null),
  });

  // Seeds the name input and keeps the parent dialog updated on validity.
  constructor() {
    effect(() => {
      const name = this.initialName();
      const current = this.form.controls.name.value.trim();

      if (!current && name) {
        this.form.patchValue({ name });
      }
    });

    this.form.statusChanges.subscribe(() => {
      this.emitValidity();
    });
  }

  // Emits the initial validity once the child form is ready.
  ngOnInit(): void {
    this.emitValidity();
  }

  // Accepts only AVIF files and stores the chosen image on the form.
  onImageSelected(event: Event): void {
    const selection = readAvifFileSelection(event);

    if (selection.kind === 'empty') {
      this.selectedImageName = '';
      this.form.controls.image.setValue(null);
      this.form.controls.image.updateValueAndValidity();
      this.emitValidity();
      return;
    }

    if (selection.kind === 'invalid-type') {
      this.selectedImageName = '';
      this.form.controls.image.setValue(null);
      this.form.controls.image.setErrors({ invalidFileType: true });
      this.form.controls.image.markAsTouched();
      if (selection.input) {
        selection.input.value = '';
      }
      this.emitValidity();
      return;
    }

    this.selectedImageName = selection.file.name;
    this.form.controls.image.setValue(selection.file);
    this.form.controls.image.markAsDirty();
    this.form.controls.image.updateValueAndValidity();
  }

  // Builds the ingredient creation request expected by the facade.
  buildCreateRequest(): IngredientAdminDetailRequest | null {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return null;
    }

    const formValue = this.form.getRawValue();
    const image = formValue.image;

    if (!image) {
      this.form.controls.image.setErrors({ required: true });
      this.form.controls.image.markAsTouched();
      return null;
    }

    return {
      name: formValue.name,
      basis: formValue.basis,
      basisUnit: formValue.basisUnit,
      price: formValue.price,
      caloriesKcal: formValue.caloriesKcal,
      image,
      proteinG: formValue.proteinG,
      fatG: formValue.fatG,
      carbsG: formValue.carbsG,
      sugarG: formValue.sugarG,
      fiberG: formValue.fiberG,
      sodiumMg: formValue.sodiumMg,
      vitaminCMg: formValue.vitaminCMg,
      ironMg: formValue.ironMg,
    };
  }

  // Notifies the parent dialog that ingredient creation was cancelled.
  cancel(): void {
    this.cancelled.emit();
  }

  // Emits the current form validity to the parent dialog.
  private emitValidity(): void {
    this.validityChanged.emit(this.form.valid);
  }
}

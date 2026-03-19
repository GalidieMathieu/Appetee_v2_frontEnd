import { Component, effect, inject, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IngredientAdminDetailDto, IngredientAdminDetailRequest } from '../../data-access/ingredients/ingredient.model';
import { IngredientsFacade } from '../../data-access/ingredients/ingredient.facade';

@Component({
  selector: 'app-ingredient-create-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: 'ingredient-creation.component.html',
  styleUrl:'./ingredient-creation.component.scss', 
})
export class IngredientCreateFormComponent {
  readonly initialName = input('', {
    transform: (value: string | null | undefined) => value?.trim() ?? '',
  });

  readonly created = output<IngredientAdminDetailDto>();
  readonly cancelled = output<void>();
  readonly validityChanged = output<boolean>();
  readonly ingredientFacade = inject(IngredientsFacade);
  selectedImageName = '';

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    basis: new FormControl<number>(100,{nonNullable: true,
      validators: [Validators.required],
    }),
    caloriesKcal:new FormControl<number>(100,{nonNullable: true,
      validators: [Validators.required],
    }),
    price: new FormControl<number | null>(null),
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

  constructor() {
    effect(() => {
      const name = this.initialName();
      const current = this.form.controls.name.value.trim();

      if (!current && name) {
        this.form.patchValue({ name });
      }
    });

    this.validityChanged.emit(this.form.valid);

    this.form.statusChanges.subscribe(() => {
      this.validityChanged.emit(this.form.valid);
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.selectedImageName = '';
      this.form.controls.image.setValue(null);
      return;
    }

    if (!this.isAvifFile(file)) {
      this.selectedImageName = '';
      this.form.controls.image.setValue(null);
      this.form.controls.image.setErrors({ invalidFileType: true });
      input.value = '';
      return;
    }

    this.selectedImageName = file.name;
    this.form.controls.image.setValue(file);
    this.form.controls.image.markAsDirty();
    this.form.controls.image.updateValueAndValidity();
  }

  createIngredient(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formValue = this.form.getRawValue();
    const image = formValue.image;

    if (!image) {
      this.form.controls.image.setErrors({ required: true });
      this.form.controls.image.markAsTouched();
      return;
    }

    const ingredientAdminDetail: IngredientAdminDetailRequest = {
      name: formValue.name,
      basis: formValue.basis,
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

    this.ingredientFacade.createIngredientWithDetails(ingredientAdminDetail).subscribe({
      next: (data: IngredientAdminDetailDto) => {
        this.created.emit(data);
      }
    });

    //this.IngredientFacade.createIngredientWithDetails(ingredientAdminDetail).subscribe{
    // next()=>{
    //  this.created.emit(createdIngredient);
    //}}
    
  }


  cancel(): void {
    this.cancelled.emit();
  }

  private isAvifFile(file: File): boolean {
    return file.type === 'image/avif' || file.name.toLowerCase().endsWith('.avif');
  }
}

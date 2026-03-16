import { Component, effect, inject, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Ingredient, IngredientAdminDetailDto, IngredientAdminDetailRequest } from '../../data-access/ingredients/ingredient.model';
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
  readonly ingredientFacade = inject(IngredientsFacade)

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
  

  createIngredient(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formValue = this.form.getRawValue();
    const ingredientAdminDetail: IngredientAdminDetailRequest = formValue;

    this.ingredientFacade.createIngredientWithDetails(ingredientAdminDetail).subscribe({
      next: (data: IngredientAdminDetailDto) => {
        // Merge API response with form values so name and other fields are always present
        // (backend may return only id on create)
        const fullDto: IngredientAdminDetailDto = {
          ...formValue,
          ...data,
          id: data.id,
          name: data.name ?? formValue.name,
        };
        this.created.emit(fullDto);
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
}
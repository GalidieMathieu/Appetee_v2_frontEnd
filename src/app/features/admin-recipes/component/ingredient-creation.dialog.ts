import { Component, Inject, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { IngredientDialogResult } from '@app/core/shared/data-access/ingredients/ingredient.model';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-ingredient-dialog',
  templateUrl : './ingredient-creation.dialog.html',
  styleUrl: './ingredient-creation.dialog.scss',
  standalone: true,
  imports: [MatDialogModule , ReactiveFormsModule, MatIconModule]
})
export class IngredientDialogComponent {
    private readonly dialogRef =
      inject<MatDialogRef<IngredientDialogComponent, IngredientDialogResult | undefined>>(MatDialogRef);
      isNewIngredient = false;
      dialog_Title : string = "Create Ingredient";
  
    constructor(
      @Inject(MAT_DIALOG_DATA) readonly data: any
    ) {}
  
    readonly ingredientForm = new FormGroup({
      ingredientName: new FormControl(''/*this.data.prefillName*/, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      walmartProductId: new FormControl<string | null>(null),
    });
  
    cancel(): void {
      this.dialogRef.close(undefined);
    }
  
    submit(): void {
  
      this.dialogRef.close({
        ingredientId: null,
        ingredientName: this.ingredientForm.controls.ingredientName.getRawValue(),
        walmartProductId: this.ingredientForm.controls.walmartProductId.value,
      });
    }
  }
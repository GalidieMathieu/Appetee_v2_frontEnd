import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface MealPlanDeleteDialogData {
  mealPlanName: string;
}

@Component({
  selector: 'app-meal-plan-delete-dialog',
  standalone: true,
  imports: [MatDialogModule],
  templateUrl: './meal-plan-delete.dialog.html',
  styleUrl: './meal-plan-delete.dialog.scss',
})
export class MealPlanDeleteDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<MealPlanDeleteDialogComponent, boolean>>(MatDialogRef);

  constructor(@Inject(MAT_DIALOG_DATA) readonly data: MealPlanDeleteDialogData) {}

  cancel(): void {
    this.dialogRef.close(false);
  }

  confirm(): void {
    this.dialogRef.close(true);
  }
}

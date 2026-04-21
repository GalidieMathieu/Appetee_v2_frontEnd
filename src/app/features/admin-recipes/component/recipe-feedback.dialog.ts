import { CommonModule } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface RecipeFeedbackDialogData {
  eyebrow: string;
  title: string;
  description: string;
  message: string;
  actionLabel?: string;
}

@Component({
  selector: 'app-recipe-feedback-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './recipe-feedback.dialog.html',
  styleUrl: './recipe-feedback.dialog.scss',
})
export class RecipeFeedbackDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<RecipeFeedbackDialogComponent, void>>(MatDialogRef);

  constructor(@Inject(MAT_DIALOG_DATA) readonly data: RecipeFeedbackDialogData) {}

  close(): void {
    this.dialogRef.close();
  }
}

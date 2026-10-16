import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
export interface PlannerDecisionData { readonly title: string; readonly message: string; readonly save?: boolean; readonly deletion?: boolean; }
@Component({
  selector: 'app-planner-decision', standalone: true, imports: [MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content><p class="text-body">{{ data.message }}</p></mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" class="btn-selection text-label" (click)="dialog.close('stay')">{{ data.deletion ? 'Cancel' : 'Stay' }}</button>
      @if(data.save) { <button type="button" class="btn-selection text-label" (click)="dialog.close('save')">Save and leave</button> }
      <button type="button" class="btn-selection text-label" (click)="dialog.close('discard')">{{ data.deletion ? 'Delete meal' : 'Discard unsent changes' }}</button>
    </mat-dialog-actions>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlannerDecisionDialog {
  readonly data = inject<PlannerDecisionData>(MAT_DIALOG_DATA);
  readonly dialog = inject(MatDialogRef<PlannerDecisionDialog, 'stay' | 'save' | 'discard'>);
}

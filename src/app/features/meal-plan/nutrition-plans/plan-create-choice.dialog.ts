import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-plan-create-choice', standalone: true,
  imports: [MatDialogModule, MatIconModule],
  templateUrl: './plan-create-choice.dialog.html',
  styleUrl: './plan-create-choice.dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanCreateChoiceDialog {
  readonly dialog = inject(MatDialogRef<PlanCreateChoiceDialog, 'easy' | 'intermediate'>);
}

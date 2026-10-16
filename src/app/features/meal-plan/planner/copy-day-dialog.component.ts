import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CopyDialogData } from '../models/copy-intent.model';
@Component({ selector: 'app-copy-day-dialog', standalone: true, imports: [MatDialogModule],
  templateUrl: './copy-day-dialog.component.html', styleUrl: './copy-day-dialog.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class CopyDayDialogComponent {
  readonly data = inject<CopyDialogData>(MAT_DIALOG_DATA);
  readonly dialog = inject(MatDialogRef);
  readonly destinationChanged = output<string>(); readonly inspect = output<void>();
  readonly acknowledge = output<boolean>(); readonly confirm = output<void>();
}

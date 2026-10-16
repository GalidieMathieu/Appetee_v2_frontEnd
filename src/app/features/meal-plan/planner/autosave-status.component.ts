import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AutosaveViewStatus } from '../state/meal-editor-draft.state';
@Component({ selector: 'app-autosave-status', standalone: true, templateUrl: './autosave-status.component.html', styleUrl: './autosave-status.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class AutosaveStatusComponent {
  readonly status = input<AutosaveViewStatus>('idle');
  readonly labels = { idle: 'No unsaved changes', dirty: 'Unsaved changes', saving: 'Saving…', saved: 'Saved', failed: 'Could not save', conflict: 'Conflict — review required', unknownOutcome: 'Outcome unknown — inspect saved data' };
}

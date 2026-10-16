import { FieldErrorLinkDirective } from './field-error-link.directive';
import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, input, output, viewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ManualItemDraftState } from '../state/manual-item-draft.state';
@Component({ selector: 'app-manual-item-editor', standalone: true, imports: [FieldErrorLinkDirective, ReactiveFormsModule],
  templateUrl: './manual-item-editor.component.html', styleUrl: './manual-item-editor.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class ManualItemEditorComponent {
  readonly draft = input.required<ManualItemDraftState>();
  readonly pending = input(false); readonly ready = input(false); readonly canReview = input(false);
  readonly submitEntry = output<void>(); readonly cancel = output<void>(); readonly refresh = output<void>(); readonly review = output<void>();
  private readonly summary = viewChild<ElementRef<HTMLElement>>('summary');
  constructor() {
    let lastAttempt = 0, lastError: string | null = null;
    afterRenderEffect(() => {
      const attempt = this.draft().focusAttempt(), error = this.draft().error(), target = this.summary()?.nativeElement;
      if (target && (attempt !== lastAttempt || error !== null && error !== lastError)) {
        target.focus(); target.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
      }
      lastAttempt = attempt; lastError = error;
    });
  }
}

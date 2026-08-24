import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthFacade } from '@app/core/auth/data-access/auth.facade';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.page.html',
  styleUrl: './password-recovery.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPage {
  private readonly authFacade = inject(AuthFacade);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly feedback = viewChild<ElementRef<HTMLElement>>('feedback');

  readonly copy = {
    checkEmailEyebrow: 'Check your email',
    instructionsRequestedTitle: 'Reset instructions requested',
    instructionsRequestedDescription:
      'If an account exists for that email, we sent password reset instructions.',
    tryAnotherEmail: 'Try another email',
    returnToLogin: 'Return to Log In',
    accountRecoveryEyebrow: 'Account recovery',
    title: 'Forgot your password?',
    description: 'Enter your email and we will send reset instructions if an account is eligible.',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    emailRequired: 'Email is required',
    emailInvalid: 'Enter a valid email address',
    submitting: 'Sending instructions...',
    submit: 'Send reset instructions',
    backToLogin: 'Back to Log In',
  } as const;

  readonly isSubmitting = this.authFacade.isPasswordRecoveryLoading;
  readonly requestSent = signal(false);
  readonly errorMessage = this.authFacade.passwordRecoveryError;

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  constructor() {
    this.authFacade.clearPasswordRecoveryError();

    effect(() => {
      if ((this.requestSent() || this.errorMessage()) && this.feedback()) {
        queueMicrotask(() => this.feedback()?.nativeElement.focus());
      }
    });
  }

  get email(): FormControl<string> {
    return this.form.controls.email;
  }

  submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.host.nativeElement.querySelector<HTMLElement>('#recoveryEmail')?.focus();
      return;
    }

    this.authFacade.requestPasswordRecovery$({ email: this.email.value.trim() }).subscribe({
      next: () => {
        this.requestSent.set(true);
      },
    });
  }

  useAnotherEmail(): void {
    this.requestSent.set(false);
    this.authFacade.clearPasswordRecoveryError();
    queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>('#recoveryEmail')?.focus());
  }
}

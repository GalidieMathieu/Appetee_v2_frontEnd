import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthFacade } from '@app/core/auth/data-access/auth.facade';
import { PASSWORD_RECOVERY_MESSAGES } from '@app/core/auth/data-access/password-recovery-error-message';

const passwordsMatch: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('newPassword')?.value;
  const confirmation = control.get('confirmPassword')?.value;
  return password && confirmation && password !== confirmation ? { passwordMismatch: true } : null;
};

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.page.html',
  styleUrl: './password-recovery.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  private readonly authFacade = inject(AuthFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly feedback = viewChild<ElementRef<HTMLElement>>('feedback');
  readonly token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';

  readonly copy = {
    passwordUpdatedEyebrow: 'Password updated',
    successTitle: 'Your password has been reset',
    successDescription: 'You can now log in with your new password.',
    continueToLogin: 'Continue to Log In',
    accountRecoveryEyebrow: 'Account recovery',
    title: 'Create a new password',
    description: 'Choose a new password for your Appetee account.',
    newPasswordLabel: 'New password',
    showPasswordsLabel: 'Show passwords',
    hidePasswordsLabel: 'Hide passwords',
    show: 'Show',
    hide: 'Hide',
    newPasswordRequired: 'New password is required',
    confirmPasswordLabel: 'Confirm new password',
    confirmPasswordRequired: 'Password confirmation is required',
    passwordsMismatch: 'Passwords must match',
    submitting: 'Resetting password...',
    submit: 'Reset password',
    requestNewLink: 'Request a new reset link',
    invalidToken: PASSWORD_RECOVERY_MESSAGES.invalidToken,
  } as const;

  readonly isSubmitting = this.authFacade.isPasswordRecoveryLoading;
  readonly passwordVisible = signal(false);
  readonly resetSucceeded = signal(false);
  readonly errorMessage = computed(
    () => this.token ? this.authFacade.passwordRecoveryError() : this.copy.invalidToken
  );

  readonly form = new FormGroup(
    {
      newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: passwordsMatch }
  );

  constructor() {
    this.authFacade.clearPasswordRecoveryError();

    effect(() => {
      if ((this.resetSucceeded() || this.errorMessage()) && this.feedback()) {
        queueMicrotask(() => this.feedback()?.nativeElement.focus());
      }
    });
  }

  get newPassword(): FormControl<string> {
    return this.form.controls.newPassword;
  }

  get confirmPassword(): FormControl<string> {
    return this.form.controls.confirmPassword;
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update(visible => !visible);
  }

  submit(): void {
    if (!this.token || this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const id = this.newPassword.invalid ? 'newPassword' : 'confirmPassword';
      this.host.nativeElement.querySelector<HTMLElement>(`#${id}`)?.focus();
      return;
    }

    this.authFacade.confirmPasswordRecovery$({
      token: this.token,
      newPassword: this.newPassword.value,
    }).subscribe({
      next: () => {
        this.resetSucceeded.set(true);
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      },
    });
  }
}

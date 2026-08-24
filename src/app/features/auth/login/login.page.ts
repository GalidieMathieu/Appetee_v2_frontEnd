import { ChangeDetectorRef, Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize, tap } from 'rxjs';
import { AuthFacade } from '@app/core/auth/data-access/auth.facade';
import { LoginRequest } from '@app/core/auth/data-access/auth.model';
import { SessionExpirationService } from '@app/core/auth/session-expiration.service';

@Component({
    selector: 'app-login-page',
    templateUrl: './login.page.html',
    imports: [RouterLink, ReactiveFormsModule],
    styleUrls: ['./login.page.scss'],
    standalone: true,
})
export class LoginPage {
    private readonly authFacade = inject(AuthFacade);
    private readonly cdr = inject(ChangeDetectorRef);
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly sessionExpiration = inject(SessionExpirationService);
    readonly errorMessage = toSignal(this.authFacade.error$, { initialValue: null });
    private readonly sessionExpiredMessage = signal(this.sessionExpiration.consumeMessage());
    readonly displayError = computed(() => this.errorMessage() ?? this.sessionExpiredMessage());
    private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');
    private readonly submitPending = signal(false);
    readonly isSubmitting = this.submitPending;
    readonly passwordVisible = signal(false);

    constructor(private router: Router) {
        effect(() => {
            if (this.displayError() && this.errorSummary()) {
                queueMicrotask(() => this.errorSummary()?.nativeElement.focus());
            }
        });
    }

    email_Label : string = "Email";
    required_email_error_label : string = "Email is required";
    inv_email_error_label : string = "Invalid email address";
    password_Label : string = "Password";
    required_password_error_label : string = "Password is required";
    minlength_password_error_label : string = "Password must be at least 8 characters long";

    SignIn_str : string = "Sign In";
    signingIn_str : string = "Signing In...";
    signUp_cta_text : string = "Don't have an account? ";
    signUp_cta_link_text : string = "Sign Up";
    forgotPassword_text : string = "Forgot Password?";
    rememberMe_label : string = "Remember Me";
    homePageText : string = "Home Page";

    title : string = "Log In";
    subTitle : string = "Sign in to discover your personalized recipes";

    loginForm = new FormGroup({
        email: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required, Validators.email],
          }),
          password: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required],
          }),
          rememberMe: new FormControl(false, { nonNullable: true }),
    });

    get email() {
        return this.loginForm.controls.email;
    }

    get password() {
        return this.loginForm.controls.password;
    }

    togglePasswordVisibility(): void {
        this.passwordVisible.update(visible => !visible);
    }

    signIn(): void {
        if (this.isSubmitting()) {
            return;
        }

        if (this.loginForm.invalid) {
            this.loginForm.markAllAsTouched();
            this.focusFirstInvalidControl();
            return;
        }

        const req: LoginRequest = this.loginForm.getRawValue();
        this.submitPending.set(true);
        let loginSucceeded = false;

        this.authFacade.login$(req).pipe(
            tap(() => {
                loginSucceeded = true;
            }),
            finalize(() => {
                this.submitPending.set(false);
                this.cdr.detectChanges();
                if (loginSucceeded) {
                    this.router.navigate(['/home']);
                }
            })
        ).subscribe({
        });
    }

    private focusFirstInvalidControl(): void {
        const firstInvalidControl = Object.entries(this.loginForm.controls)
            .find(([, control]) => control.invalid)?.[0];

        if (firstInvalidControl) {
            this.host.nativeElement.querySelector<HTMLElement>(`#${firstInvalidControl}`)?.focus();
        }
    }

}

import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize, tap } from 'rxjs';
import { AuthFacade } from '@app/core/auth/data-access/auth.facade';
import { LoginRequest } from '@app/core/auth/data-access/auth.model';

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
    readonly errorMessage = toSignal(this.authFacade.error$, { initialValue: null });
    private readonly submitPending = signal(false);
    readonly isSubmitting = this.submitPending;

    constructor(private router: Router) {}

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
    });

    get email() {
        return this.loginForm.controls.email;
    }

    get password() {
        return this.loginForm.controls.password;
    }

    

    SignIn() {
        if (this.loginForm.invalid || this.isSubmitting()) {
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

}

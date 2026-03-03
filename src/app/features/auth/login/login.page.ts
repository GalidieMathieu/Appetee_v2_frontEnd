import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
    constructor(private router: Router) {}

    email_Label : string = "Email";
    required_email_error_label : string = "Email is required";
    inv_email_error_label : string = "Invalid email address";
    password_Label : string = "Password";
    required_password_error_label : string = "Password is required";
    minlength_password_error_label : string = "Password must be at least 8 characters long";

    SignIn_str : string = "Sign In";
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
        const req: LoginRequest = this.loginForm.getRawValue();
        this.authFacade.login$(req).subscribe({
            next: () => {
                this.router.navigate(['/home']);
            }
        });
    }

}
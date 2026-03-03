import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SignUpWizard } from '../sign-up.wizard';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './step-account.page.html',
  styleUrl:'./step-account.page.scss'
})
export class StepAccountPage {
  // Inject the shared wizard service
  wizard = inject(SignUpWizard);

  // Convenience getters for each control
  get email() {
    return this.wizard.account.controls.email;
  }

  get username() {
    return this.wizard.account.controls.username;
  }

  get password() {
    return this.wizard.account.controls.password;
  }

  get confirmPassword() {
    return this.wizard.account.controls.confirmPassword;
  }

  // Utility to check if passwords mismatch (group-level error)
  get passwordsMismatch() {
    return this.wizard.account.touched && this.wizard.account.errors?.['passwordMismatch'];
  }

  ngOnInit() {
    const p = this.password;

    const update = () => {
      if (!p.touched) { this.inv_pass_error_label = ''; return; }

      if (p.hasError('required')) {
        this.inv_pass_error_label = 'Username is required';
        return;
      }

      if (p.hasError('minlength')) {
        const req = p.getError('minlength')?.requiredLength;
        this.inv_pass_error_label = `Password must be at least ${req} characters`;
        return;
      }

      this.inv_pass_error_label = '';
    };

    p.valueChanges.subscribe(update);
    p.statusChanges.subscribe(update);
    update();
  }

  //label
  email_Label : string = "Email";
  inv_email_error_label : string = "Invalid email address";

  username_Label : string = "Username";
  username_error_text : string = "pls enter an username";

  password_title : string = "Paswword";
  inv_pass_error_label : string = "";

  confirm_password_title = "Confirm Password";
  email_taken_error_label : string = "Email already taken, pls change email or log In";
}

// sign-up.wizard.ts
import { Injectable, OnDestroy } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

const passwordMatch: ValidatorFn = (ctrl: AbstractControl): ValidationErrors | null => {
  const group = ctrl as FormGroup;
  const p = group.get('password')?.value;
  const c = group.get('confirmPassword')?.value;
  return p && c && p !== c ? { passwordMismatch: true } : null;
};

@Injectable()
export class SignUpWizard{

    constructor() {
        console.log('SignUpWizard created', this.account.value);
      }
      
      reset(): void {
        this.account.reset();
        this.diet.reset({ dietIds: [] });
        this.avoid.reset({ ingredientIds: [] });
      }

  readonly account = new FormGroup(
    {
      email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
      username: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(4)] }),
      password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
      confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: [passwordMatch] }
  );

  readonly diet = new FormGroup({
    dietIds: new FormControl<number[]>([], { nonNullable: true, validators: [Validators.required] }),
  });

  readonly avoid = new FormGroup({
    searchCtrl : new FormControl('', { nonNullable: true }),
    ingredientIds: new FormControl<number[]>([], { nonNullable: true }),
  });

  validate(group: FormGroup): boolean {
    group.markAllAsTouched();
    group.updateValueAndValidity();
    return group.valid;
  }

  
  public addError(ctrl : AbstractControl , key : string) : void{
    ctrl.setErrors({...(ctrl.errors ?? {}) , [key] : true});
  }

  public removeError(ctrl : AbstractControl , key : string) : void{
   const  errors = {...(ctrl.errors?? {})};
   delete errors[key];
   ctrl.setErrors(Object.keys(errors).length?errors  : null);
  }
}

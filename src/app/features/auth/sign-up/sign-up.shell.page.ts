import { ChangeDetectorRef, Component, inject, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize, tap } from 'rxjs';
import { SignUpWizard } from './sign-up.wizard';
import { UserFacade } from '@app/core/shared/data-access/user/user.facade';
import { AuthFacade } from '@app/core/auth/data-access/auth.facade';
import { SignUpRequest } from '@app/core/auth/data-access/auth.model';
import { DietsFacade } from '@app/core/shared/data-access/diets/diets.facade';
import { IngredientsFacade } from '@app/core/shared/data-access/ingredients/ingredient.facade';

@Component({
  standalone: true,
  selector: 'app-sign-up-shell',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './sign-up.shell.page.html',
  styleUrl: './sign-up.shell.page.scss',
})
export class SignUpShellPage implements OnDestroy{

    //Probably can do that in a JsonObject
    private readonly steps = ['account', 'diet', 'ingredient'] as const;
    private readonly stepsTitle = [
        'Create Your Account',
        'Choose Your Diets',
        'Select Ingredients to Avoid'
      ];
      private readonly stepsSubTitle = [
        'Set up your Appetee account with your email and password',
        'Tell us about your dietary preferences so we can personalize recipes',
        'We will avoid recipes with these ingredients. You can add your own or select from used ones.'
      ];
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly cdr = inject(ChangeDetectorRef);
    private currentStepOverride: number | null = null;
    back_str : string = "Back";
    next_str : string = "Next";
    account_creation_str : string = "create account";
    account_creation_loading_str : string = "Creating Account...";
    get currentIndex(): number {
        return this.currentStepOverride ?? this.resolveStepIndex();
    }

    get title(): string {
        return this.stepsTitle[this.currentIndex] ?? this.stepsTitle[0];
    }

    get subTitle(): string {
        return this.stepsSubTitle[this.currentIndex] ?? this.stepsSubTitle[0];
    }

    //injections 
    readonly wizard = inject(SignUpWizard);
    private readonly user_authFacace = inject(UserFacade);
    private readonly authFacade = inject(AuthFacade);
    private readonly dietsFacade = inject(DietsFacade);
    private readonly ingredientsFacade = inject(IngredientsFacade);
    private readonly authError = toSignal(this.authFacade.error$, { initialValue: null });
    private readonly submitPending = signal(false);
    readonly isSubmitting = this.submitPending;
    private readonly userError = toSignal(this.user_authFacace.error$, { initialValue: null });
    private readonly dietsError = toSignal(this.dietsFacade.error$, { initialValue: null });
    private readonly ingredientsError = toSignal(this.ingredientsFacade.error$, { initialValue: null });

    ngOnDestroy(): void {
        Promise.resolve().then(() => this.wizard.reset());
    }

    //Personal Notes : using get is better for wizard button
    get canGoNext(): boolean {
        return (this.wizard.account.valid);
    }

    get isNextAvailable() : boolean{
        return (this.currentIndex !== 2)
    }

    get canGoBack() : boolean{
        return this.currentIndex >= 1;
    }

    get isLast() : boolean{
        return this.currentIndex == 2;
    }

    goBack(): void {
        if (this.isSubmitting()) return;
        if (this.currentIndex === 0) return;
        this.router.navigate([this.steps[this.currentIndex - 1]], { relativeTo: this.route});
      }

    goNext(): void {
        if (this.isSubmitting()) return;
        if (this.currentIndex >= this.steps.length - 1) return;
        if(this.currentIndex == 0){
            this.checkEmailAndProceed();
        }else{
            this.router.navigate([this.steps[this.currentIndex +1]], { relativeTo: this.route});
        }

    }

    setStep(index: number) {
        this.currentStepOverride = index;
      }

    goFinishSignUp(): void{
        if(this.isSubmitting()) return;
        if(this.wizard.account.invalid) return;
        const req = this.buildSignUpRequest();
        this.submitPending.set(true);
        let signUpSucceeded = false;

        this.authFacade.signUp(req).pipe(
            tap(() => {
                signUpSucceeded = true;
            }),
            finalize(() => {
                if (!signUpSucceeded) {
                    this.submitPending.set(false);
                    this.cdr.detectChanges();
                }
            })
        ).subscribe({
            complete: () => {
                if (signUpSucceeded) {
                    this.router.navigateByUrl('/home');
                }
            }
        });
    }

    buildSignUpRequest(): SignUpRequest {
        const account = this.wizard.account.getRawValue();
        const diet = this.wizard.diet.getRawValue();
        const avoid = this.wizard.avoid.getRawValue();
      
        return {
          username: account.username.trim(),    // default choice if you don’t collect it
          email: account.email.trim(),
          password: account.password,                       
          dietIds: diet.dietIds?.length ? diet.dietIds : null,
          ingredientRestrictionIds: avoid.ingredientIds?.length ? avoid.ingredientIds : null
        };
    }

    checkEmailAndProceed() : void {
        //double check that doesnt allowed to go next if all input are not valid
        this.wizard.account.markAllAsTouched();
        if (this.wizard.account.invalid) return;

        //now checking if the email is valid : 
        const emailCtrl = this.wizard.account.controls.email;
        const email = emailCtrl.value.trim();

        // clear previous
        this.wizard.removeError(emailCtrl, 'emailTaken');
        this.user_authFacace.checkEmailAndProceed$(email).subscribe(result =>{
            if (result === 'available') {
                this.router.navigate([this.steps[this.currentIndex +1]], { relativeTo: this.route});
            } else if (result === 'taken') {
                this.wizard.addError(emailCtrl, 'emailTaken'); // validation feedback
                emailCtrl.markAsTouched();
            }
        });
    }

    errorMessage(): string | null {
        if (this.currentIndex === 1) {
            return this.dietsError();
        }

        if (this.currentIndex === 2) {
            return this.authError() ?? this.ingredientsError();
        }

        return this.authError() ?? this.userError();
    }

    private resolveStepIndex(): number {
        const segments = this.router.url.split('/').filter(Boolean);
        const childPath = segments[segments.length - 1] ?? 'account';
        const idx = this.steps.indexOf(childPath as (typeof this.steps)[number]);

        return idx >= 0 ? idx : 0;
    }

}

import { Component, DestroyRef, inject, OnDestroy , OnInit} from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { SignUpWizard } from './sign-up.wizard';
import { UserFacade } from '@app/core/shared/data-access/user/user.facade';
import { AuthFacade } from '@app/core/auth/data-access/auth.facade';
import { SignUpRequest } from '@app/core/auth/data-access/auth.model';

@Component({
  standalone: true,
  selector: 'app-sign-up-shell',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './sign-up.shell.page.html',
  styleUrl: './sign-up.shell.page.scss',
})
export class SignUpShellPage implements OnDestroy, OnInit{

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
    currentIndex = 0;
    back_str : string = "Back";
    next_str : string = "Next";
    account_creation_str : string = "create account";
    title = this.stepsTitle[0];
    subTitle = this.stepsSubTitle[0];


    //injections 
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    readonly wizard = inject(SignUpWizard);
    private readonly user_authFacace = inject(UserFacade);
    private readonly authFacade = inject(AuthFacade);
    private readonly destroyRef = inject(DestroyRef);

    ngOnDestroy(): void {
        this.wizard.reset();
    }

    ngOnInit(): void {
        //this is to make sure we are in the right page, and the index is link with the navigation
        this.router.events
        .pipe(filter(e => e instanceof NavigationEnd) , 
            takeUntilDestroyed(this.destroyRef))
        .subscribe(() => { 
            const childPath = this.route.firstChild?.snapshot.routeConfig?.path ?? 'account'; 
            const idx = this.steps.indexOf(childPath as any); 
            this.currentIndex = idx >= 0 ? idx : 0; 
            this.setStep(this.currentIndex);
        });
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
        if (this.currentIndex === 0) return;
        this.router.navigate([this.steps[this.currentIndex - 1]], { relativeTo: this.route});
      }

    goNext(): void {
        if (this.currentIndex >= this.steps.length - 1) return;
        if(this.currentIndex == 0){
            this.checkEmailAndProceed();
        }else{
            this.router.navigate([this.steps[this.currentIndex +1]], { relativeTo: this.route});
        }

    }

    setStep(index: number) {
        this.currentIndex = index;
        this.title = this.stepsTitle[index];
        this.subTitle = this.stepsSubTitle[index];
      }

    goFinishSignUp(): void{
        if(this.wizard.account.invalid) return;
        const req = this.buildSignUpRequest();
        this.authFacade.signUp(req).subscribe({
             next: () => this.router.navigateByUrl('/home') 
            });
    }

    buildSignUpRequest(): SignUpRequest {
        const account = this.wizard.account.getRawValue();
        const diet = this.wizard.diet.getRawValue();
        const avoid = this.wizard.avoid.getRawValue();
      
        return {
          username: account.username.trim(),    // default choice if you don’t collect it
          email: account.email.trim(),
          password: account.password,                        // or omit it
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
        this.user_authFacace.checkEmailAndProceed$(email).subscribe(canProceed =>{
            if (canProceed) this.router.navigate([this.steps[this.currentIndex +1]], { relativeTo: this.route});
            else{
                this.wizard.addError(emailCtrl, 'emailTaken'); // validation feedback
                emailCtrl.markAsTouched();
                return;
            }
        });
    }

}

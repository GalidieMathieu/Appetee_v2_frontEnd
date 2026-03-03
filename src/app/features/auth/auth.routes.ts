import { Routes } from '@angular/router';
import { signupWizardGuard } from './sign-up/sign-up.wizard.guard';
import { SignUpWizard } from './sign-up/sign-up.wizard';

export const AUTH_ROUTES: Routes = [
    { path: 'login', loadComponent: () => import('./login/login.page').then(m => m.LoginPage) },
    {
        path: 'sign-up',
        loadComponent: () => import('./sign-up/sign-up.shell.page').then(m => m.SignUpShellPage),
        providers:[SignUpWizard],
        canActivateChild: [signupWizardGuard],
        children: [
            { path: '', pathMatch: 'full', redirectTo: 'account'},
            { path: 'account', loadComponent: () => import('./sign-up/steps/step-account.page').then(m => m.StepAccountPage) },
            { path: 'diet', loadComponent: () => import('./sign-up/steps/step-diet.page').then(m => m.StepDietPage) },
            { path: 'ingredient', loadComponent: () => import('./sign-up/steps/step-ingredient.page').then(m => m.StepIngredientPage) },
            // ...
        ],
    },
    {path: 'Login', loadComponent: () => import('./login/login.page').then(m => m.LoginPage) },
  ];
  

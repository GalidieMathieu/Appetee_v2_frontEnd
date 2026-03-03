import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { SignUpWizard } from './sign-up.wizard';

export const signupWizardGuard: CanActivateChildFn = (childRoute, state) => {
  const router = inject(Router);
  const wizard = inject(SignUpWizard);

  const childPath = childRoute.routeConfig?.path; // '', 'account', 'diet', ...

  // Allow redirect child and account step
  if (childPath === '' || childPath === 'account') {
    return true;
  }

  // Gate other steps until account is completed
  const accountComplete = wizard.account.valid; // or wizard.accountCompleted flag
  if (!accountComplete) {
    console.log(wizard.account.valid);
    console.log('state.url:', state.url, 'childPath:', childRoute.routeConfig?.path);
    // Relative redirect (prevents "/sign-up" vs "/auth/sign-up" mismatch)
    return router.createUrlTree(['/sign-up/account']);
  }

  return true;
};

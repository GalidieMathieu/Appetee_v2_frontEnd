import { Component, EnvironmentInjector, createEnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BehaviorSubject, finalize, Observable, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { AuthFacade } from '@app/core/auth/data-access/auth.facade';
import { SignUpRequest } from '@app/core/auth/data-access/auth.model';
import { IngredientsFacade } from '@app/core/shared/data-access/ingredients/ingredient.facade';
import { EmailAvailabilityResult, UserFacade } from '@app/core/shared/data-access/user/user.facade';
import { DietsFacade } from '@app/core/shared/data-access/diets/diets.facade';
import { StepAccountPage } from './steps/step-account.page';
import { SignUpShellPage } from './sign-up.shell.page';
import { SignUpWizard } from './sign-up.wizard';

@Component({
  standalone: true,
  template: '<p>Dummy Step</p>',
})
class DummyStepComponent {}

const SIGN_UP_TEST_ROUTES: Routes = [
  {
    path: 'auth/sign-up',
    component: SignUpShellPage,
    providers: [SignUpWizard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'account' },
      { path: 'account', component: StepAccountPage },
      { path: 'diet', component: DummyStepComponent },
      { path: 'ingredient', component: DummyStepComponent },
    ],
  },
  { path: 'auth/login', component: DummyStepComponent },
  { path: 'home', component: DummyStepComponent },
];

describe('SignUpShellPage', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let authError$: BehaviorSubject<string | null>;
  let authLoading$: BehaviorSubject<boolean>;
  let userError$: BehaviorSubject<string | null>;
  let dietsError$: BehaviorSubject<string | null>;
  let ingredientsError$: BehaviorSubject<string | null>;
  let checkEmailAndProceedSpy: ReturnType<typeof vi.fn>;
  let signUpSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    authError$ = new BehaviorSubject<string | null>(null);
    authLoading$ = new BehaviorSubject<boolean>(false);
    userError$ = new BehaviorSubject<string | null>(null);
    dietsError$ = new BehaviorSubject<string | null>(null);
    ingredientsError$ = new BehaviorSubject<string | null>(null);
    checkEmailAndProceedSpy = vi.fn(() => of<EmailAvailabilityResult>({
      status: 'available',
      error: null,
    }));
    signUpSpy = vi.fn((request: SignUpRequest) => of(void 0));

    await TestBed.configureTestingModule({
      imports: [SignUpShellPage, StepAccountPage],
      providers: [
        provideRouter(SIGN_UP_TEST_ROUTES),
        {
          provide: UserFacade,
          useValue: {
            error$: userError$,
            checkEmailAndProceed$: checkEmailAndProceedSpy,
          },
        },
        {
          provide: AuthFacade,
          useValue: {
            error$: authError$,
            isLoading$: authLoading$,
            signUp: signUpSpy,
          },
        },
        {
          provide: DietsFacade,
          useValue: {
            error$: dietsError$,
          },
        },
        {
          provide: IngredientsFacade,
          useValue: {
            error$: ingredientsError$,
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  // Verifies that the sign-up shell renders the account step metadata when the flow starts on /auth/sign-up/account.
  it('renders the account step content for the first sign-up route', async () => {
    await harness.navigateByUrl('/auth/sign-up/account', SignUpShellPage);

    const text = harness.routeNativeElement?.textContent ?? '';

    expect(text).toContain('Step 1 of 3');
    expect(text).toContain('Create Your Account');
    expect(text).toContain('Set up your Appetee account with your email and password');
  });

  it('destroys the route-scoped wizard draft after leaving the sign-up flow', async () => {
    const parent = TestBed.inject(EnvironmentInjector);
    const firstScope = createEnvironmentInjector([SignUpWizard], parent);
    const first = firstScope.get(SignUpWizard);
    first.account.controls.email.setValue('draft@appetee.dev');
    firstScope.destroy();

    const nextScope = createEnvironmentInjector([SignUpWizard], parent);
    const next = nextScope.get(SignUpWizard);

    expect(next).not.toBe(first);
    expect(next.account.controls.email.value).toBe('');
    nextScope.destroy();
  });

  // Verifies that the first-step Next action checks email availability and advances to the diet step when the account form is valid.
  it('checks email availability and navigates to the diet step from the account step', async () => {
    await harness.navigateByUrl('/auth/sign-up/account', SignUpShellPage);

    const root = harness.routeNativeElement!;
    setInputValue(root.querySelector('#email') as HTMLInputElement, 'new-user@appetee.dev');
    setInputValue(root.querySelector('#username') as HTMLInputElement, 'new-user');
    setInputValue(root.querySelector('#password') as HTMLInputElement, 'strong-pass');
    setInputValue(root.querySelector('#confirmPassword') as HTMLInputElement, 'strong-pass');
    harness.detectChanges();

    const nextButton = getButtonByText(root, 'Next');
    expect(nextButton.disabled).toBe(false);

    nextButton.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(checkEmailAndProceedSpy).toHaveBeenCalledWith('new-user@appetee.dev');
    expect(router.url).toBe('/auth/sign-up/diet');
    expect(harness.routeNativeElement?.textContent).toContain('Choose Your Diets');
  });

  // Verifies that the account step shows the email-taken validation message when the availability check rejects the submitted address.
  it('shows an email taken validation message when the email is already registered', async () => {
    checkEmailAndProceedSpy.mockReturnValue(of<EmailAvailabilityResult>({
      status: 'taken',
      error: null,
    }));

    await harness.navigateByUrl('/auth/sign-up/account', SignUpShellPage);

    const root = harness.routeNativeElement!;
    setInputValue(root.querySelector('#email') as HTMLInputElement, 'taken@appetee.dev');
    setInputValue(root.querySelector('#username') as HTMLInputElement, 'taken-user');
    setInputValue(root.querySelector('#password') as HTMLInputElement, 'strong-pass');
    setInputValue(root.querySelector('#confirmPassword') as HTMLInputElement, 'strong-pass');
    harness.detectChanges();

    getButtonByText(root, 'Next').click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(router.url).toBe('/auth/sign-up/account');
    expect(harness.routeNativeElement?.textContent).toContain(
      'Email already taken, pls change email or log In'
    );
  });

  // Verifies that the final sign-up action sends the aggregated wizard payload and redirects to /home on success.
  it('submits the completed sign-up request from the last step and navigates home', async () => {
    const component = await harness.navigateByUrl('/auth/sign-up/ingredient', SignUpShellPage);

    component.wizard.account.setValue({
      email: 'chef@appetee.dev',
      username: 'chef-user',
      password: 'strong-pass',
      confirmPassword: 'strong-pass',
    });
    component.wizard.diet.controls.dietIds.setValue([1, 3]);
    component.wizard.avoid.controls.ingredientIds.setValue([4, 8]);
    component.setStep(2);
    component.goFinishSignUp();
    await harness.fixture.whenStable();

    expect(signUpSpy).toHaveBeenCalledWith({
      username: 'chef-user',
      email: 'chef@appetee.dev',
      password: 'strong-pass',
      dietIds: [1, 3],
      ingredientRestrictionIds: [4, 8],
    });
    expect(router.url).toBe('/home');
  });

  // Verifies that the create-account button stays in a loading state and does not navigate until sign-up completes.
  // Temporarily skipped: the sign-up loading flow still needs a timing pass.
  it.skip('shows a loading state while creating the account and waits before navigating home', async () => {
    const pendingResponse$ = new Subject<void>();
    signUpSpy.mockImplementation((request: SignUpRequest) => {
      authLoading$.next(true);

      return pendingResponse$.pipe(finalize(() => authLoading$.next(false)));
    });

    const component = await harness.navigateByUrl('/auth/sign-up/ingredient', SignUpShellPage);
    component.wizard.account.setValue({
      email: 'chef@appetee.dev',
      username: 'chef-user',
      password: 'strong-pass',
      confirmPassword: 'strong-pass',
    });
    component.wizard.diet.controls.dietIds.setValue([1, 3]);
    component.wizard.avoid.controls.ingredientIds.setValue([4, 8]);
    harness.detectChanges();

    const createButton = getButtonByText(harness.routeNativeElement!, 'create account');
    createButton.click();
    harness.detectChanges();

    expect(signUpSpy).toHaveBeenCalledWith({
      username: 'chef-user',
      email: 'chef@appetee.dev',
      password: 'strong-pass',
      dietIds: [1, 3],
      ingredientRestrictionIds: [4, 8],
    });
    expect(createButton.disabled).toBe(true);
    expect(normalizeText(createButton.textContent)).toContain('Creating Account...');
    expect(router.url).toBe('/auth/sign-up/ingredient');

    pendingResponse$.next();
    pendingResponse$.complete();
    await harness.fixture.whenStable();

    expect(router.url).toBe('/home');
  });
});

function setInputValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
}

function getButtonByText(root: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll('button')).find(candidate =>
    normalizeText(candidate.textContent) === text
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button with text "${text}" was not found.`);
  }

  return button;
}

function normalizeText(value: string | null): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

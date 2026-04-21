import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BehaviorSubject, finalize, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { AuthFacade } from '@app/core/auth/data-access/auth.facade';
import { LoginRequest } from '@app/core/auth/data-access/auth.model';
import { LoginPage } from './login.page';

@Component({
  standalone: true,
  template: '<p>Dummy Page</p>',
})
class DummyPageComponent {}

const LOGIN_TEST_ROUTES: Routes = [
  { path: '', component: DummyPageComponent },
  { path: 'auth/login', component: LoginPage },
  { path: 'auth/sign-up', component: DummyPageComponent },
  { path: 'home', component: DummyPageComponent },
];

describe('LoginPage', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let authError$: BehaviorSubject<string | null>;
  let authLoading$: BehaviorSubject<boolean>;
  let loginSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    authError$ = new BehaviorSubject<string | null>(null);
    authLoading$ = new BehaviorSubject<boolean>(false);
    loginSpy = vi.fn((request: LoginRequest) => of(void 0));

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter(LOGIN_TEST_ROUTES),
        {
          provide: AuthFacade,
          useValue: {
            error$: authError$,
            isLoading$: authLoading$,
            login$: loginSpy,
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  // Verifies that the login page renders the expected copy, fields, and disabled submit state on first load.
  it('renders the login form content and initial disabled state', async () => {
    const { root, emailInput, passwordInput, submitButton } = await navigateToLoginPage();

    expect(root.textContent).toContain('Log In');
    expect(root.textContent).toContain('Sign in to discover your personalized recipes');
    expect(root.textContent).toContain("Don't have an account?");
    expect(emailInput.placeholder).toBe('you@example.com');
    expect(passwordInput.placeholder).toBe('********');
    expect(passwordInput.type).toBe('password');
    expect(submitButton.disabled).toBe(true);
  });

  // Verifies that the login page points users to the sign-up flow and back to the landing page with real router links.
  it('exposes the expected navigation links', async () => {
    const { root } = await navigateToLoginPage();

    expect(getLinkContainingText(root, 'Sign Up').getAttribute('href')).toBe('/auth/sign-up');
    expect(getLinkContainingText(root, 'Home Page').getAttribute('href')).toBe('/');
  });

  // Verifies that touched invalid controls show the required validation feedback and malformed email input shows the format error.
  it('shows validation feedback after the user touches invalid controls', async () => {
    const { root, emailInput, passwordInput, submitButton } = await navigateToLoginPage();

    blurInput(emailInput);
    blurInput(passwordInput);
    harness.detectChanges();

    expect(getAlertTexts(root)).toContain('Email is required');
    expect(getAlertTexts(root)).toContain('Password is required');
    expect(emailInput.getAttribute('aria-invalid')).toBe('true');
    expect(submitButton.disabled).toBe(true);

    setInputValue(emailInput, 'not-an-email');
    harness.detectChanges();

    const alerts = getAlertTexts(root);
    expect(alerts).toContain('Invalid email address');
    expect(alerts).not.toContain('Email is required');
    expect(emailInput.getAttribute('aria-invalid')).toBe('true');
  });

  // Verifies that invalid form state prevents the facade call so partial or malformed credentials are never submitted.
  it('does not submit while the form is invalid', async () => {
    const { emailInput, submitButton } = await navigateToLoginPage();

    setInputValue(emailInput, 'chef@appetee.dev');
    harness.detectChanges();

    expect(submitButton.disabled).toBe(true);

    submitButton.click();
    await harness.fixture.whenStable();

    expect(loginSpy).not.toHaveBeenCalled();
    expect(router.url).toBe('/auth/login');
  });

  // Verifies that a facade-level authentication error is surfaced to the user on the login page.
  it('renders the current authentication error message', async () => {
    const { root } = await navigateToLoginPage();

    authError$.next('Invalid email or password.');
    harness.detectChanges();

    expect(getAlertTexts(root)).toContain('Invalid email or password.');
  });

  // Verifies that typing into the DOM updates the reactive form model, submits the exact payload, and redirects on success.
  it('submits valid credentials and navigates to the home page on success', async () => {
    const expectedRequest: LoginRequest = {
      email: 'chef@appetee.dev',
      password: 'strong-password',
    };

    const { component, emailInput, passwordInput, submitButton } = await navigateToLoginPage();

    setInputValue(emailInput, expectedRequest.email);
    setInputValue(passwordInput, expectedRequest.password);
    harness.detectChanges();

    expect(component.loginForm.getRawValue()).toEqual(expectedRequest);
    expect(submitButton.disabled).toBe(false);

    submitButton.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(loginSpy).toHaveBeenCalledTimes(1);
    expect(loginSpy).toHaveBeenCalledWith(expectedRequest);
    expect(router.url).toBe('/home');
  });

  // Verifies that the submit button shows a loading state and keeps the user on the login route until auth completes.
  it('shows a loading button state and waits for completion before navigating', async () => {
    const pendingResponse$ = new Subject<void>();
    loginSpy.mockImplementation((request: LoginRequest) => {
      authLoading$.next(true);

      return pendingResponse$.pipe(finalize(() => authLoading$.next(false)));
    });

    const { emailInput, passwordInput, submitButton } = await navigateToLoginPage();

    setInputValue(emailInput, 'chef@appetee.dev');
    setInputValue(passwordInput, 'strong-password');
    harness.detectChanges();

    submitButton.click();
    harness.detectChanges();

    expect(loginSpy).toHaveBeenCalledWith({
      email: 'chef@appetee.dev',
      password: 'strong-password',
    });
    expect(submitButton.disabled).toBe(true);
    expect(normalizeText(submitButton.textContent)).toContain('Signing In...');
    expect(router.url).toBe('/auth/login');

    pendingResponse$.next();
    pendingResponse$.complete();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(normalizeText(submitButton.textContent)).toContain('Sign In');
    expect(router.url).toBe('/home');
  });

  async function navigateToLoginPage(): Promise<{
    component: LoginPage;
    root: HTMLElement;
    emailInput: HTMLInputElement;
    passwordInput: HTMLInputElement;
    submitButton: HTMLButtonElement;
  }> {
    const component = await harness.navigateByUrl('/auth/login', LoginPage);
    const root = harness.routeNativeElement;

    if (!(root instanceof HTMLElement)) {
      throw new Error('The login page did not render.');
    }

    return {
      component,
      root,
      emailInput: getInputById(root, 'email'),
      passwordInput: getInputById(root, 'password'),
      submitButton: getButtonByText(root, 'Sign In'),
    };
  }
});

// Simulates a user typing into the input and leaving the field so Angular updates value, validity, and touched state.
function setInputValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
}

// Simulates a user focusing and leaving a field without typing so required validation can surface.
function blurInput(input: HTMLInputElement): void {
  input.dispatchEvent(new Event('blur'));
}

// Reads the active alert messages so validation and auth errors can be asserted by their user-facing text.
function getAlertTexts(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll('[role="alert"]'))
    .map(alert => alert.textContent?.trim() ?? '')
    .filter(Boolean);
}

// Returns a required input by its id and fails loudly if the template changes unexpectedly.
function getInputById(root: HTMLElement, id: string): HTMLInputElement {
  const input = root.querySelector(`#${id}`);

  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Input with id "${id}" was not found.`);
  }

  return input;
}

// Returns the first router link whose visible text contains the expected copy.
function getLinkContainingText(root: HTMLElement, text: string): HTMLAnchorElement {
  const link = Array.from(root.querySelectorAll('a')).find(candidate =>
    normalizeText(candidate.textContent).includes(text)
  );

  if (!(link instanceof HTMLAnchorElement)) {
    throw new Error(`Link containing text "${text}" was not found.`);
  }

  return link;
}

// Returns a required button by its exact text so the spec stays close to the real UI copy.
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

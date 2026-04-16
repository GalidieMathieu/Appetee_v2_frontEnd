import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import { AuthFacade } from '@app/core/auth/data-access/auth.facade';
import { LoginRequest } from '@app/core/auth/data-access/auth.model';
import { LoginPage } from './login.page';

@Component({
  standalone: true,
  template: '<p>Dummy Page</p>',
})
class DummyPageComponent {}

describe('LoginPage', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let authError$: BehaviorSubject<string | null>;
  let loginSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    authError$ = new BehaviorSubject<string | null>(null);
    loginSpy = vi.fn((request: LoginRequest) => of(void 0));

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([
          { path: 'auth/login', component: LoginPage },
          { path: 'auth/sign-up', component: DummyPageComponent },
          { path: 'home', component: DummyPageComponent },
        ]),
        {
          provide: AuthFacade,
          useValue: {
            error$: authError$,
            login$: loginSpy,
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  // Verifies that the login page renders its core copy and keeps submission disabled until the form is valid.
  it('renders the login page and disables submission for an invalid form', async () => {
    await harness.navigateByUrl('/auth/login', LoginPage);

    const root = harness.routeNativeElement!;
    const submitButton = getButtonByText(root, 'Sign In');

    expect(root.textContent).toContain('Log In');
    expect(root.textContent).toContain('Sign in to discover your personalized recipes');
    expect(submitButton.disabled).toBe(true);
  });

  // Verifies that a facade-level authentication error is surfaced to the user on the login page.
  it('renders the current authentication error message', async () => {
    await harness.navigateByUrl('/auth/login', LoginPage);

    authError$.next('Invalid email or password.');
    harness.detectChanges();

    const alert = harness.routeNativeElement?.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Invalid email or password.');
  });

  // Verifies that a valid login submission calls the auth facade with the form payload and redirects to /home.
  it('submits valid credentials and navigates to the home page on success', async () => {
    await harness.navigateByUrl('/auth/login', LoginPage);

    const root = harness.routeNativeElement!;
    setInputValue(root.querySelector('#email') as HTMLInputElement, 'chef@appetee.dev');
    setInputValue(root.querySelector('#password') as HTMLInputElement, 'strong-password');
    harness.detectChanges();

    const submitButton = getButtonByText(root, 'Sign In');
    expect(submitButton.disabled).toBe(false);

    submitButton.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(loginSpy).toHaveBeenCalledWith({
      email: 'chef@appetee.dev',
      password: 'strong-password',
    });
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
    candidate.textContent?.trim() === text
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button with text "${text}" was not found.`);
  }

  return button;
}

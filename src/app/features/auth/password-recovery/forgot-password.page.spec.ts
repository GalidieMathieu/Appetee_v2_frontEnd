import { Component, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { EMPTY, finalize, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { AuthFacade } from '@app/core/auth/data-access/auth.facade';
import { PasswordRecoveryRequest } from '@app/core/auth/data-access/auth.model';
import { ForgotPasswordPage } from './forgot-password.page';

@Component({ standalone: true, template: '' })
class DummyPage {}

const ROUTES: Routes = [
  { path: 'auth/forgot-password', component: ForgotPasswordPage },
  { path: 'auth/login', component: DummyPage },
];

describe('ForgotPasswordPage', () => {
  let harness: RouterTestingHarness;
  let requestSpy: ReturnType<typeof vi.fn>;
  let recoveryError: WritableSignal<string | null>;
  let recoveryLoading: WritableSignal<boolean>;

  beforeEach(async () => {
    recoveryError = signal<string | null>(null);
    recoveryLoading = signal(false);
    requestSpy = vi.fn((_request: PasswordRecoveryRequest) => of(void 0));

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordPage],
      providers: [
        provideRouter(ROUTES),
        {
          provide: AuthFacade,
          useValue: {
            passwordRecoveryError: recoveryError.asReadonly(),
            isPasswordRecoveryLoading: recoveryLoading.asReadonly(),
            clearPasswordRecoveryError: vi.fn(() => recoveryError.set(null)),
            requestPasswordRecovery$: requestSpy,
          },
        },
      ],
    }).compileComponents();

    harness = await RouterTestingHarness.create();
  });

  it('renders an accessible email recovery form and Login link', async () => {
    const root = await navigate();
    const email = getInput(root, 'recoveryEmail');
    const loginLink = getLink(root, 'Back to Log In');

    expect(root.textContent).toContain('Forgot your password?');
    expect(email.type).toBe('email');
    expect(email.autocomplete).toBe('email');
    expect(loginLink.getAttribute('href')).toBe('/auth/login');
    expect(loginLink.classList.contains('btn-link--back')).toBe(true);
    expect(loginLink.closest('main')).toBeNull();
  });

  it('focuses invalid email feedback without calling the API', async () => {
    const root = await navigate();
    const email = getInput(root, 'recoveryEmail');

    getButton(root, 'Send reset instructions').click();
    harness.detectChanges();

    expect(requestSpy).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Email is required');
    expect(document.activeElement).toBe(email);
  });

  it('submits trimmed email and always presents generic sent confirmation', async () => {
    const root = await navigate();
    setInput(getInput(root, 'recoveryEmail'), '  chef@appetee.dev  ');
    harness.detectChanges();

    getButton(root, 'Send reset instructions').click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(requestSpy).toHaveBeenCalledWith({ email: 'chef@appetee.dev' });
    expect(root.textContent).toContain(
      'If an account exists for that email, we sent password reset instructions.'
    );
    expect(root.textContent).not.toContain('chef@appetee.dev');
    expect(document.activeElement?.getAttribute('role')).toBe('status');
  });

  it('prevents duplicate requests while submission is pending', async () => {
    const pending = new Subject<void>();
    requestSpy.mockImplementation(() => {
      recoveryLoading.set(true);
      return pending.pipe(finalize(() => recoveryLoading.set(false)));
    });
    const root = await navigate();
    setInput(getInput(root, 'recoveryEmail'), 'chef@appetee.dev');
    harness.detectChanges();
    const button = getButton(root, 'Send reset instructions');

    button.click();
    harness.detectChanges();
    button.click();

    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    pending.next();
    pending.complete();
  });

  it('does not expose backend account-specific errors', async () => {
    requestSpy.mockImplementation(() => {
      recoveryError.set('We could not send password reset instructions. Please try again.');
      return EMPTY;
    });
    const root = await navigate();
    setInput(getInput(root, 'recoveryEmail'), 'unknown@appetee.dev');
    harness.detectChanges();

    getButton(root, 'Send reset instructions').click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(root.textContent).toContain(
      'We could not send password reset instructions. Please try again.'
    );
    expect(root.textContent).not.toContain('No user has that email.');
  });

  async function navigate(): Promise<HTMLElement> {
    await harness.navigateByUrl('/auth/forgot-password', ForgotPasswordPage);
    const root = harness.routeNativeElement;
    if (!(root instanceof HTMLElement)) throw new Error('Forgot password page did not render.');
    return root;
  }
});

function setInput(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function getInput(root: HTMLElement, id: string): HTMLInputElement {
  const input = root.querySelector(`#${id}`);
  if (!(input instanceof HTMLInputElement)) throw new Error(`Input "${id}" was not found.`);
  return input;
}

function getButton(root: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll('button')).find(candidate =>
    candidate.textContent?.replace(/\s+/g, ' ').trim() === text
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button "${text}" was not found.`);
  return button;
}

function getLink(root: HTMLElement, text: string): HTMLAnchorElement {
  const link = Array.from(root.querySelectorAll('a')).find(candidate =>
    candidate.textContent?.includes(text)
  );
  if (!(link instanceof HTMLAnchorElement)) throw new Error(`Link "${text}" was not found.`);
  return link;
}

import { Component, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { EMPTY, of } from 'rxjs';
import { vi } from 'vitest';
import { AuthFacade } from '@app/core/auth/data-access/auth.facade';
import { PasswordRecoveryConfirmRequest } from '@app/core/auth/data-access/auth.model';
import { ResetPasswordPage } from './reset-password.page';

@Component({ standalone: true, template: '' })
class DummyPage {}

const ROUTES: Routes = [
  { path: 'auth/reset-password', component: ResetPasswordPage },
  { path: 'auth/forgot-password', component: DummyPage },
  { path: 'auth/login', component: DummyPage },
];

describe('ResetPasswordPage', () => {
  let harness: RouterTestingHarness;
  let confirmSpy: ReturnType<typeof vi.fn>;
  let recoveryError: WritableSignal<string | null>;
  let recoveryLoading: WritableSignal<boolean>;

  beforeEach(async () => {
    recoveryError = signal<string | null>(null);
    recoveryLoading = signal(false);
    confirmSpy = vi.fn((_request: PasswordRecoveryConfirmRequest) => of(void 0));

    await TestBed.configureTestingModule({
      imports: [ResetPasswordPage],
      providers: [
        provideRouter(ROUTES),
        {
          provide: AuthFacade,
          useValue: {
            passwordRecoveryError: recoveryError.asReadonly(),
            isPasswordRecoveryLoading: recoveryLoading.asReadonly(),
            clearPasswordRecoveryError: vi.fn(() => recoveryError.set(null)),
            confirmPasswordRecovery$: confirmSpy,
          },
        },
      ],
    }).compileComponents();

    harness = await RouterTestingHarness.create();
  });

  it('rejects a missing token without rendering password fields', async () => {
    const root = await navigate('/auth/reset-password');

    expect(root.textContent).toContain(
      'This password reset link is invalid or has expired. Request a new link.'
    );
    expect(root.querySelector('form')).toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('requires matching password confirmation before submission', async () => {
    const root = await navigate('/auth/reset-password?token=valid-token');
    setInput(getInput(root, 'newPassword'), 'first-password');
    setInput(getInput(root, 'confirmPassword'), 'different-password');
    harness.detectChanges();

    getButton(root, 'Reset password').click();
    harness.detectChanges();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Passwords must match');
    expect(document.activeElement).toBe(getInput(root, 'confirmPassword'));
  });

  it('toggles both password fields with accessible state', async () => {
    const root = await navigate('/auth/reset-password?token=valid-token');
    const toggle = getButton(root, 'Show');

    toggle.click();
    harness.detectChanges();

    expect(getInput(root, 'newPassword').type).toBe('text');
    expect(getInput(root, 'confirmPassword').type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Hide passwords');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('submits only token and new password, removes the token URL, and shows success', async () => {
    const root = await navigate('/auth/reset-password?token=single-use-token');
    setInput(getInput(root, 'newPassword'), 'new-password');
    setInput(getInput(root, 'confirmPassword'), 'new-password');
    harness.detectChanges();

    getButton(root, 'Reset password').click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(confirmSpy).toHaveBeenCalledWith({
      token: 'single-use-token',
      newPassword: 'new-password',
    });
    expect(root.textContent).toContain('Your password has been reset');
    expect(TestBed.inject(Router).url).toBe('/auth/reset-password');
    expect(document.activeElement?.getAttribute('role')).toBe('status');
  });

  it('shows one safe outcome for invalid, expired, or used tokens', async () => {
    confirmSpy.mockImplementation(() => {
      recoveryError.set('This password reset link is invalid or has expired. Request a new link.');
      return EMPTY;
    });
    const root = await navigate('/auth/reset-password?token=used-token');
    setInput(getInput(root, 'newPassword'), 'new-password');
    setInput(getInput(root, 'confirmPassword'), 'new-password');
    harness.detectChanges();

    getButton(root, 'Reset password').click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(root.textContent).toContain(
      'This password reset link is invalid or has expired. Request a new link.'
    );
    expect(root.textContent).not.toContain('already consumed');
  });

  async function navigate(url: string): Promise<HTMLElement> {
    await harness.navigateByUrl(url, ResetPasswordPage);
    const root = harness.routeNativeElement;
    if (!(root instanceof HTMLElement)) throw new Error('Reset password page did not render.');
    return root;
  }
});

function setInput(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
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

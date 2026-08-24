import { HttpErrorResponse } from '@angular/common/http';
import {
  toPasswordRecoveryConfirmMessage,
  toPasswordRecoveryRequestMessage,
} from './password-recovery-error-message';

describe('password recovery error messages', () => {
  it.each([
    [400, { code: 'password_reset_token_invalid' }],
    [404, {}],
    [409, { code: 'password_reset_token_used' }],
    [410, { code: 'password_reset_token_expired' }],
  ])('uses one safe token outcome for status %i', (status, error) => {
    expect(toPasswordRecoveryConfirmMessage(new HttpErrorResponse({ status, error }))).toBe(
      'This password reset link is invalid or has expired. Request a new link.'
    );
  });

  it('maps throttled request and confirmation attempts without exposing thresholds', () => {
    expect(toPasswordRecoveryRequestMessage(new HttpErrorResponse({ status: 429 }))).toBe(
      'Too many recovery requests. Please try again later.'
    );
    expect(toPasswordRecoveryConfirmMessage(new HttpErrorResponse({ status: 429 }))).toBe(
      'Too many reset attempts. Please try again later.'
    );
  });

  it('uses retryable offline feedback', () => {
    const offline = new HttpErrorResponse({ status: 0 });

    expect(toPasswordRecoveryRequestMessage(offline)).toContain('Check your connection');
    expect(toPasswordRecoveryConfirmMessage(offline)).toContain('Check your connection');
  });
});

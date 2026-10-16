import { HttpErrorResponse } from '@angular/common/http';
import { toApiErrorMessage } from '../shared/data-access/generic-template/api-error-message';
import {
  toPasswordRecoveryConfirmMessage, toPasswordRecoveryRequestMessage,
} from './data-access/password-recovery-error-message';
import { CSRF_REJECTED_MESSAGE, isCsrfInvalidError } from './csrf-error';

describe('confirmed CSRF rejection', () => {
  it('distinguishes the confirmed backend code from validation and ambiguous transport failures', () => {
    const rejected = new HttpErrorResponse({ status: 400, error: { code: 'csrf_invalid' } });
    expect(isCsrfInvalidError(rejected)).toBe(true);
    for (const error of [
      new HttpErrorResponse({ status: 0, error: { code: 'csrf_invalid' } }),
      new HttpErrorResponse({ status: 403, error: { code: 'csrf_invalid' } }),
      new HttpErrorResponse({ status: 400, error: { code: 'validation_failed' } }),
      new Error('csrf_invalid'),
    ]) expect(isCsrfInvalidError(error)).toBe(false);
  });

  it('provides explicit re-submit feedback instead of misreporting an invalid recovery link', () => {
    const error = new HttpErrorResponse({ status: 400, error: { code: 'csrf_invalid', detail: 'Untrusted detail' } });
    expect(toApiErrorMessage(error)).toBe(CSRF_REJECTED_MESSAGE);
    expect(toPasswordRecoveryRequestMessage(error)).toBe(CSRF_REJECTED_MESSAGE);
    expect(toPasswordRecoveryConfirmMessage(error)).toBe(CSRF_REJECTED_MESSAGE);
    expect(toPasswordRecoveryConfirmMessage(new HttpErrorResponse({ status: 400,
      error: { code: 'password_reset_token_invalid' } }))).toContain('link is invalid');
  });
});

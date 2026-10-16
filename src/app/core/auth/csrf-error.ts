import { HttpErrorResponse } from '@angular/common/http';

export const CSRF_REJECTED_MESSAGE =
  'The security check failed. Your request was not applied. Please submit it again.';

/** Only this confirmed, pre-execution backend rejection is a CSRF failure. */
export function isCsrfInvalidError(error: unknown): error is HttpErrorResponse {
  return error instanceof HttpErrorResponse && error.status === 400
    && typeof error.error === 'object' && error.error !== null
    && error.error.code === 'csrf_invalid';
}

import { HttpErrorResponse } from '@angular/common/http';

export const PASSWORD_RECOVERY_MESSAGES = {
  offline: 'Cannot reach the server. Check your connection and try again.',
  requestThrottled: 'Too many recovery requests. Please try again later.',
  requestFailed: 'We could not send password reset instructions. Please try again.',
  confirmThrottled: 'Too many reset attempts. Please try again later.',
  invalidToken: 'This password reset link is invalid or has expired. Request a new link.',
  confirmFailed: 'We could not reset your password. Please try again.',
} as const;

export function toPasswordRecoveryRequestMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return PASSWORD_RECOVERY_MESSAGES.offline;
    }

    if (error.status === 429) {
      return PASSWORD_RECOVERY_MESSAGES.requestThrottled;
    }
  }

  return PASSWORD_RECOVERY_MESSAGES.requestFailed;
}

export function toPasswordRecoveryConfirmMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return PASSWORD_RECOVERY_MESSAGES.offline;
    }

    if (error.status === 429) {
      return PASSWORD_RECOVERY_MESSAGES.confirmThrottled;
    }

    const code = extractErrorCode(error.error);
    if (
      error.status === 400
      || error.status === 404
      || error.status === 409
      || error.status === 410
      || code === 'password_reset_token_invalid'
      || code === 'password_reset_token_expired'
      || code === 'password_reset_token_used'
    ) {
      return PASSWORD_RECOVERY_MESSAGES.invalidToken;
    }
  }

  return PASSWORD_RECOVERY_MESSAGES.confirmFailed;
}

function extractErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const code = (payload as Record<string, unknown>)['code'];
  return typeof code === 'string' ? code : null;
}

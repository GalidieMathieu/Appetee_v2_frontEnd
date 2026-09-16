import { HttpErrorResponse } from '@angular/common/http';

/** Converts transport/backend failures into safe messages suitable for UI state. */
export function toApiErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const backendMessage = extractBackendMessage(error.error);

    switch (error.status) {
      case 0:
        return 'Cannot reach the server. Check your connection and try again.';
      case 400:
        return backendMessage ?? 'Some information is invalid. Please review your input and try again.';
      case 401:
        return backendMessage ?? 'You are not authorized. Please sign in again.';
      case 403:
        return backendMessage ?? 'You do not have permission to perform this action.';
      case 404:
        return backendMessage ?? 'The requested resource was not found.';
      case 409:
        return backendMessage ?? 'This action conflicts with existing data.';
      case 500:
        return 'An internal server error occurred. Please try again.';
      default:
        return backendMessage ?? `Request failed (${error.status}).`;
    }
  }

  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'Something went wrong. Please try again.';
}

function extractBackendMessage(error: unknown): string | null {
  if (typeof error === 'string') return error.trim() || null;
  if (!error || typeof error !== 'object') return null;

  const payload = error as Record<string, unknown>;
  for (const key of ['message', 'detail', 'title', 'error']) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  const errors = payload['errors'];
  if (errors && typeof errors === 'object') {
    for (const value of Object.values(errors as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        const first = value.find(item => typeof item === 'string' && item.trim());
        if (typeof first === 'string') return first.trim();
      }
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
}

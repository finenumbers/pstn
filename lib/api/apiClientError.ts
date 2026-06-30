export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly retryAfterSec: number | undefined;

  constructor(
    status: number,
    userMessage: string,
    options?: { code?: string; retryAfterSec?: number }
  ) {
    super(userMessage);
    this.name = "ApiClientError";
    this.status = status;
    this.code = options?.code;
    this.retryAfterSec = options?.retryAfterSec;
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export function isApiErrorCode(error: unknown, code: string): boolean {
  return isApiClientError(error) && error.code === code;
}

export function getErrorUserMessage(error: unknown, fallback: string): string {
  if (isApiClientError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

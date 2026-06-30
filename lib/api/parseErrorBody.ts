export interface ParsedErrorBody {
  code?: string;
  message?: string;
  retryAfterSec?: number;
}

function readRetryAfterSec(details: unknown): number | undefined {
  if (!details || typeof details !== "object") return undefined;
  const value = (details as { retryAfterSec?: unknown }).retryAfterSec;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

/** Parse API error JSON (structured or legacy string shape). */
export function parseErrorBody(body: unknown): ParsedErrorBody {
  if (!body || typeof body !== "object") return {};

  const record = body as { error?: unknown };
  const error = record.error;

  if (typeof error === "string") {
    return { message: error };
  }

  if (!error || typeof error !== "object") return {};

  const structured = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };

  return {
    code: typeof structured.code === "string" ? structured.code : undefined,
    message:
      typeof structured.message === "string" ? structured.message : undefined,
    retryAfterSec: readRetryAfterSec(structured.details),
  };
}

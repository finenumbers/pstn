import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { logApiTiming } from "@/lib/api/logger";

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    { error: { code, message, details } },
    { status }
  );
}

export function validationError(error: ZodError) {
  return apiError("VALIDATION_ERROR", "Invalid request parameters", 400, {
    issues: error.issues,
  });
}

/** Never forward raw error.message to clients in production. */
export function internalServerError(
  error: unknown,
  fallback = "Internal server error"
) {
  console.error(error);
  const message =
    process.env.NODE_ENV === "production"
      ? fallback
      : error instanceof Error
        ? error.message
        : fallback;
  return apiError("INTERNAL_ERROR", message, 500);
}

export function withTiming(
  route: string,
  startMs: number,
  meta: Record<string, unknown>
) {
  logApiTiming(route, startMs, meta);
}

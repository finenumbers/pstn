import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { API_ERROR_CODES } from "@/lib/api/apiErrorCodes";
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
  return apiError(
    API_ERROR_CODES.VALIDATION_ERROR,
    "Некорректные параметры фильтра или сортировки.",
    400,
    { issues: error.issues }
  );
}

/** Never forward raw error.message to clients in production. */
export function internalServerError(
  error: unknown,
  fallback = "Внутренняя ошибка сервера. Попробуйте позже."
) {
  console.error(error);
  const message =
    process.env.NODE_ENV === "production"
      ? fallback
      : error instanceof Error
        ? error.message
        : fallback;
  return apiError(API_ERROR_CODES.INTERNAL_ERROR, message, 500);
}

export function withTiming(
  route: string,
  startMs: number,
  meta: Record<string, unknown>
) {
  logApiTiming(route, startMs, meta);
}

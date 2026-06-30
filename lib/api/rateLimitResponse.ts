import { NextResponse } from "next/server";
import { API_ERROR_CODES } from "@/lib/api/apiErrorCodes";

export function rateLimitExceeded(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: API_ERROR_CODES.RATE_LIMITED,
        message: `Слишком много запросов. Повторите через ${retryAfterSec} сек.`,
        details: { retryAfterSec },
      },
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    }
  );
}

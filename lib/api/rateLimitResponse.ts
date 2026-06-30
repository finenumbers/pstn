import { NextResponse } from "next/server";

export function rateLimitExceeded(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    }
  );
}

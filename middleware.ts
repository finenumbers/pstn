import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkRateLimit,
  resolveRateLimitConfig,
  type RateLimitBucket,
} from "@/lib/api/rateLimit";
import { rateLimitExceeded } from "@/lib/api/rateLimitResponse";

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function resolveBucket(pathname: string): RateLimitBucket | null {
  if (pathname === "/api/import") return "import";
  if (pathname === "/api/export/ranges") return "export";
  if (pathname === "/api/ranges/facets") return "facets";
  if (pathname.startsWith("/api/v1/lookup")) return "lookup";
  return null;
}

export function middleware(request: NextRequest) {
  const bucket = resolveBucket(request.nextUrl.pathname);
  if (!bucket) {
    return NextResponse.next();
  }

  const config = resolveRateLimitConfig(bucket);
  const key = `${bucket}:${clientIp(request)}`;
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    return rateLimitExceeded(result.retryAfterSec);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/import",
    "/api/export/ranges",
    "/api/ranges/facets",
    "/api/v1/lookup/:path*",
  ],
};

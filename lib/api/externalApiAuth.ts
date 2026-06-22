import { safeEqual } from "@/lib/api/safeEqual";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";

function readBearerToken(authorization: string | null): string | undefined {
  if (!authorization) return undefined;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

export function isExternalApiConfigured(): boolean {
  return Boolean(process.env.EXTERNAL_API_KEY?.trim());
}

export function getExternalApiKey(): string | undefined {
  const key = process.env.EXTERNAL_API_KEY?.trim();
  return key || undefined;
}

export function checkExternalApiAuthorization(
  request: Request
): NextResponse | null {
  const configuredKey = process.env.EXTERNAL_API_KEY?.trim();
  if (!configuredKey) {
    return apiError(
      "SERVICE_UNAVAILABLE",
      "External lookup API is not configured",
      503
    );
  }

  const bearer = readBearerToken(request.headers.get("authorization"));
  const headerKey = request.headers.get("x-api-key")?.trim();
  const provided = bearer ?? headerKey;

  if (!provided || !safeEqual(configuredKey, provided)) {
    return apiError("UNAUTHORIZED", "Invalid or missing API key", 401);
  }

  return null;
}

import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/api/safeEqual";
import { apiError } from "@/lib/api/errors";

export function checkImportAuthorization(
  request: Request
): NextResponse | null {
  const secret = process.env.IMPORT_SECRET?.trim();
  if (!secret) {
    return null;
  }

  const headerSecret = request.headers.get("x-import-secret")?.trim();
  if (headerSecret && safeEqual(secret, headerSecret)) {
    return null;
  }

  return apiError("UNAUTHORIZED", "Invalid or missing import secret", 401);
}

export function requireImportSecret(request: Request): NextResponse | null {
  const secret = process.env.IMPORT_SECRET?.trim();
  if (!secret) {
    return apiError(
      "UNAUTHORIZED",
      "IMPORT_SECRET is required for scheduled imports",
      401
    );
  }
  return checkImportAuthorization(request);
}

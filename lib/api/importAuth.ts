import { NextResponse } from "next/server";
import { API_ERROR_CODES } from "@/lib/api/apiErrorCodes";
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

  return apiError(
    API_ERROR_CODES.UNAUTHORIZED,
    "Неверный или отсутствующий секрет импорта.",
    401
  );
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

import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";

export function checkImportAuthorization(
  request: Request
): NextResponse | null {
  const secret = process.env.IMPORT_SECRET?.trim();
  if (!secret) {
    return null;
  }

  const headerSecret = request.headers.get("x-import-secret")?.trim();
  if (headerSecret === secret) {
    return null;
  }

  return apiError("UNAUTHORIZED", "Invalid or missing import secret", 401);
}

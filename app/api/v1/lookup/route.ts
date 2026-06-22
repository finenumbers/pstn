import { NextRequest, NextResponse } from "next/server";
import { lookupQuerySchema } from "@/packages/shared/contracts/lookup.schema";
import { lookupByPhone } from "@/packages/db/queries/lookupByPhone";
import { checkExternalApiAuthorization } from "@/lib/api/externalApiAuth";
import { internalServerError, validationError, withTiming } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  const startMs = Date.now();

  const authError = checkExternalApiAuthorization(request);
  if (authError) {
    return authError;
  }

  try {
    const phone = request.nextUrl.searchParams.get("phone") ?? "";
    const parsed = lookupQuerySchema.safeParse({ phone });
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const row = await lookupByPhone(parsed.data.phone);
    withTiming("/api/v1/lookup", startMs, {
      phone: parsed.data.phone,
      found: Boolean(row),
    });

    if (!row) {
      return NextResponse.json(
        { found: false, phone: parsed.data.phone },
        { status: 404 }
      );
    }

    return NextResponse.json({
      found: true,
      phone: parsed.data.phone,
      data: row,
    });
  } catch (error) {
    return internalServerError(error);
  }
}

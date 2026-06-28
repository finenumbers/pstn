import { NextRequest, NextResponse } from "next/server";
import { lookupQuerySchema } from "@/packages/shared/contracts/lookup.schema";
import { lookupByPhone } from "@/packages/db/queries/lookupByPhone";
import { checkExternalApiAuthorization } from "@/lib/api/externalApiAuth";
import { apiError, internalServerError, validationError, withTiming } from "@/lib/api/errors";

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

    const result = await lookupByPhone(parsed.data.phone);
    withTiming("/api/v1/lookup", startMs, {
      phone: parsed.data.phone,
      found: result.status === "found",
      ambiguous: result.status === "ambiguous",
    });

    if (result.status === "not_found") {
      return NextResponse.json(
        { found: false, phone: parsed.data.phone },
        { status: 404 }
      );
    }

    if (result.status === "ambiguous") {
      return apiError(
        "AMBIGUOUS_MATCH",
        "Multiple ranges matched the phone number",
        409,
        { phone: parsed.data.phone, matchCount: result.matchCount }
      );
    }

    return NextResponse.json({
      found: true,
      phone: parsed.data.phone,
      data: result.row,
    });
  } catch (error) {
    return internalServerError(error);
  }
}

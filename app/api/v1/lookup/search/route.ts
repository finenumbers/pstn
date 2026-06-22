import { NextRequest, NextResponse } from "next/server";
import { parseLookupSearchQuery } from "@/packages/shared/contracts/lookup.schema";
import { DEFAULT_FILTERS, DEFAULT_SORT } from "@/packages/shared/contracts/filters.schema";
import { listRanges } from "@/packages/db/queries/rangesQueries";
import { checkExternalApiAuthorization } from "@/lib/api/externalApiAuth";
import { internalServerError, validationError, withTiming } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  const startMs = Date.now();

  const authError = checkExternalApiAuthorization(request);
  if (authError) {
    return authError;
  }

  try {
    const params = request.nextUrl.searchParams;
    const parsed = parseLookupSearchQuery({
      phone: params.get("phone") ?? "",
      page: params.get("page") ?? 1,
      pageSize: params.get("pageSize") ?? 50,
    });

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { normalized, display, page, pageSize } = parsed.data;

    const { data, totalRows, hasMore } = await listRanges({
      filters: {
        ...DEFAULT_FILTERS,
        phoneNumber: normalized,
      },
      sort: DEFAULT_SORT,
      pageSize,
      page,
    });

    withTiming("/api/v1/lookup/search", startMs, {
      phone: display,
      rowsReturned: data.length,
      totalRows,
      page,
    });

    return NextResponse.json({
      phone: display,
      data,
      meta: {
        page,
        pageSize,
        totalRows,
        hasMore,
      },
    });
  } catch (error) {
    return internalServerError(error);
  }
}

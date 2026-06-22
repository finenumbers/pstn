import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_FILTERS,
  filtersSchema,
  parseFiltersFromSearchParams,
  parseSortParam,
  rangesQuerySchema,
  type SortableColumn,
} from "@/packages/shared/contracts/filters.schema";
import { decodeRangesCursor } from "@/lib/api/rangesCursor";
import { normalizeRangesSort } from "@/lib/sort/normalizeRangesSort";
import { listRanges } from "@/packages/db/queries/rangesQueries";
import { apiError, validationError, withTiming } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  const startMs = Date.now();
  try {
    const params = request.nextUrl.searchParams;
    const parsed = rangesQuerySchema.safeParse({
      page: params.get("page") ?? 1,
      pageSize: params.get("pageSize") ?? 50,
      sort: params.get("sort") ?? undefined,
      cursor: params.get("cursor") ?? undefined,
    });

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const filtersRaw = parseFiltersFromSearchParams(params);
    const filtersParsed = filtersSchema.safeParse(filtersRaw);
    const filters = filtersParsed.success
      ? filtersParsed.data
      : DEFAULT_FILTERS;

    const sort = normalizeRangesSort(parseSortParam(parsed.data.sort));
    const cursor = parsed.data.cursor
      ? decodeRangesCursor(parsed.data.cursor)
      : null;

    if (parsed.data.cursor && !cursor) {
      return apiError("VALIDATION_ERROR", "Invalid cursor", 400);
    }

    const { data, totalRows, hasMore } = await listRanges({
      filters,
      sort,
      pageSize: parsed.data.pageSize,
      cursor,
      page: cursor ? undefined : parsed.data.page,
    });

    withTiming("/api/ranges", startMs, {
      rowsReturned: data.length,
      totalRows,
      hasMore,
      cursor: Boolean(cursor),
    });

    return NextResponse.json({
      data,
      meta: {
        pageSize: parsed.data.pageSize,
        totalRows,
        hasMore,
        sort: sort as { id: SortableColumn; desc: boolean }[],
      },
    });
  } catch (error) {
    console.error("ranges GET error:", error);
    return apiError(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Internal server error",
      500
    );
  }
}

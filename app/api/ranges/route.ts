import { NextRequest, NextResponse } from "next/server";
import {
  filtersSchema,
  parseFiltersFromSearchParams,
  parseSortParam,
  rangesQuerySchema,
  type SortableColumn,
} from "@/packages/shared/contracts/filters.schema";
import { decodeRangesCursor } from "@/lib/api/rangesCursor";
import {
  isDatasetAndAsOfParseError,
  parseDatasetAndAsOf,
} from "@/lib/api/datasetAndAsOf";
import { DatasetNotFoundError } from "@/packages/db/errors/datasetErrors";
import { datasetNotFoundResponse } from "@/lib/api/datasetParam";
import { normalizeRangesSort } from "@/lib/sort/normalizeRangesSort";
import { listRanges } from "@/packages/db/queries/rangesQueries";
import { shouldSkipPhoneRangeCount } from "@/lib/filters/phoneSearchLimits";
import { phoneFilterTimingMeta } from "@/lib/phone/phoneFilterMeta";
import { API_ERROR_CODES } from "@/lib/api/apiErrorCodes";
import { apiError, internalServerError, validationError, withTiming } from "@/lib/api/errors";

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
    if (!filtersParsed.success) {
      return validationError(filtersParsed.error);
    }
    const filters = filtersParsed.data;

    const sort = normalizeRangesSort(parseSortParam(parsed.data.sort));
    const cursor = parsed.data.cursor
      ? decodeRangesCursor(parsed.data.cursor)
      : null;

    if (parsed.data.cursor && !cursor) {
      return apiError(
        API_ERROR_CODES.VALIDATION_ERROR,
        "Некорректный курсор постраничной навигации.",
        400
      );
    }

    const parsedDataset = parseDatasetAndAsOf(params);
    if (isDatasetAndAsOfParseError(parsedDataset)) {
      return parsedDataset;
    }
    const { dataset, asOf } = parsedDataset;

    const { data, totalRows, hasMore } = await listRanges({
      filters,
      sort,
      pageSize: parsed.data.pageSize,
      cursor,
      page: cursor ? undefined : parsed.data.page,
      skipCount: shouldSkipPhoneRangeCount(filters),
      dataset,
      asOf,
    });

    withTiming("/api/ranges", startMs, {
      rowsReturned: data.length,
      totalRows,
      hasMore,
      cursor: Boolean(cursor),
      skipCount: shouldSkipPhoneRangeCount(filters),
      ...phoneFilterTimingMeta(filters),
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
    if (error instanceof DatasetNotFoundError) {
      return datasetNotFoundResponse(error);
    }
    return internalServerError(error);
  }
}

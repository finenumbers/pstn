import { NextRequest, NextResponse } from "next/server";
import { parseLookupByInnQuery } from "@/packages/shared/contracts/lookup.schema";
import { DEFAULT_FILTERS, DEFAULT_SORT } from "@/packages/shared/contracts/filters.schema";
import { isDatasetParseError, parseDatasetOrError } from "@/lib/api/datasetQuery";
import { DatasetNotFoundError } from "@/packages/db/errors/datasetErrors";
import { datasetNotFoundResponse } from "@/lib/api/datasetParam";
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
    const parsed = parseLookupByInnQuery({
      inn: params.get("inn") ?? "",
      page: params.get("page") ?? 1,
      pageSize: params.get("pageSize") ?? 50,
    });

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { inn, page, pageSize } = parsed.data;
    const dataset = parseDatasetOrError(params);
    if (isDatasetParseError(dataset)) {
      return dataset;
    }

    const { data, totalRows, hasMore } = await listRanges({
      filters: {
        ...DEFAULT_FILTERS,
        inn: [inn],
      },
      sort: DEFAULT_SORT,
      pageSize,
      page,
      dataset,
    });

    withTiming("/api/v1/lookup/by-inn", startMs, {
      inn,
      rowsReturned: data.length,
      totalRows,
      page,
    });

    return NextResponse.json({
      inn,
      data,
      meta: {
        page,
        pageSize,
        totalRows,
        hasMore,
      },
    });
  } catch (error) {
    if (error instanceof DatasetNotFoundError) {
      return datasetNotFoundResponse(error);
    }
    return internalServerError(error);
  }
}

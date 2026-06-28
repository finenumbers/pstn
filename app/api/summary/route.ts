import { NextRequest, NextResponse } from "next/server";
import {
  filtersSchema,
  parseFiltersFromSearchParams,
} from "@/packages/shared/contracts/filters.schema";
import { isDatasetParseError, parseDatasetOrError } from "@/lib/api/datasetQuery";
import { DatasetNotFoundError } from "@/packages/db/errors/datasetErrors";
import { datasetNotFoundResponse } from "@/lib/api/datasetParam";
import { summaryRanges } from "@/packages/db/queries/rangesQueries";
import { phoneFilterTimingMeta } from "@/lib/phone/phoneFilterMeta";
import { internalServerError, validationError, withTiming } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  const startMs = Date.now();
  try {
    const params = request.nextUrl.searchParams;
    const filtersRaw = parseFiltersFromSearchParams(params);
    const filtersParsed = filtersSchema.safeParse(filtersRaw);
    if (!filtersParsed.success) {
      return validationError(filtersParsed.error);
    }
    const filters = filtersParsed.data;
    const dataset = parseDatasetOrError(params);
    if (isDatasetParseError(dataset)) {
      return dataset;
    }

    const summary = await summaryRanges(filters, dataset);

    withTiming("/api/summary", startMs, {
      ...phoneFilterTimingMeta(filters),
    });

    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof DatasetNotFoundError) {
      return datasetNotFoundResponse(error);
    }
    return internalServerError(error);
  }
}

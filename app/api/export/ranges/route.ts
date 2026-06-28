import { NextRequest } from "next/server";
import {
  filtersSchema,
  parseFiltersFromSearchParams,
} from "@/packages/shared/contracts/filters.schema";
import { countRanges } from "@/packages/db/queries/rangesQueries";
import { createRangesXlsxExport } from "@/lib/export/writeRangesXlsx";
import { isDatasetParseError, parseDatasetOrError } from "@/lib/api/datasetQuery";
import { DatasetNotFoundError } from "@/packages/db/errors/datasetErrors";
import { datasetNotFoundResponse } from "@/lib/api/datasetParam";
import { EXPORT_ROW_MAX } from "@/lib/export/exportLimits";
import { apiError, internalServerError, validationError, withTiming } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  const startMs = Date.now();
  try {
    const params = request.nextUrl.searchParams;
    const filtersRaw = parseFiltersFromSearchParams(params);
    const filtersParsed = filtersSchema.safeParse(filtersRaw);
    if (!filtersParsed.success) {
      return validationError(filtersParsed.error);
    }

    const dataset = parseDatasetOrError(params);
    if (isDatasetParseError(dataset)) {
      return dataset;
    }

    const totalRows = await countRanges(filtersParsed.data, dataset);
    if (totalRows > EXPORT_ROW_MAX) {
      return apiError(
        "EXPORT_TOO_LARGE",
        `Export exceeds maximum of ${EXPORT_ROW_MAX.toLocaleString("ru-RU")} rows (${totalRows.toLocaleString("ru-RU")} matched). Narrow filters.`,
        400
      );
    }

    const { body } = await createRangesXlsxExport(
      filtersParsed.data,
      totalRows,
      dataset
    );

    withTiming("/api/export/ranges", startMs, { rows: totalRows, format: "xlsx" });

    return new Response(body, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=ranges-export.xlsx",
        "X-Export-Row-Count": String(totalRows),
      },
    });
  } catch (error) {
    if (error instanceof DatasetNotFoundError) {
      return datasetNotFoundResponse(error);
    }
    return internalServerError(error, "Export failed");
  }
}

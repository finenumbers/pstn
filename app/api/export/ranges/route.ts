import { NextRequest } from "next/server";
import {
  filtersSchema,
  parseFiltersFromSearchParams,
} from "@/packages/shared/contracts/filters.schema";
import { countRanges } from "@/packages/db/queries/rangesQueries";
import { createRangesXlsxExport } from "@/lib/export/writeRangesXlsx";
import {
  isDatasetAndAsOfParseError,
  parseDatasetAndAsOf,
} from "@/lib/api/datasetAndAsOf";
import { DatasetNotFoundError } from "@/packages/db/errors/datasetErrors";
import { datasetNotFoundResponse } from "@/lib/api/datasetParam";
import { EXPORT_ASYNC_THRESHOLD } from "@/lib/export/exportLimits";
import { API_ERROR_CODES } from "@/lib/api/apiErrorCodes";
import {
  apiError,
  internalServerError,
  validationError,
  withTiming,
} from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  const startMs = Date.now();
  try {
    const params = request.nextUrl.searchParams;
    const filtersRaw = parseFiltersFromSearchParams(params);
    const filtersParsed = filtersSchema.safeParse(filtersRaw);
    if (!filtersParsed.success) {
      return validationError(filtersParsed.error);
    }

    const parsedDataset = parseDatasetAndAsOf(params);
    if (isDatasetAndAsOfParseError(parsedDataset)) {
      return parsedDataset;
    }
    const { dataset, asOf } = parsedDataset;

    const totalRows = await countRanges(filtersParsed.data, dataset, asOf);
    if (totalRows > EXPORT_ASYNC_THRESHOLD) {
      return apiError(
        API_ERROR_CODES.EXPORT_USE_ASYNC,
        `Слишком большая выборка для синхронного экспорта (${totalRows.toLocaleString("ru-RU")} строк). Используйте POST /api/export/jobs.`,
        400,
        { matched: totalRows, asyncThreshold: EXPORT_ASYNC_THRESHOLD }
      );
    }

    const { body } = await createRangesXlsxExport(
      filtersParsed.data,
      totalRows,
      dataset,
      asOf,
      request.signal
    );

    withTiming("/api/export/ranges", startMs, {
      rows: totalRows,
      format: "xlsx",
      path: "sync",
    });

    return new Response(body, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=ranges-export.xlsx",
        "X-Export-Row-Count": String(totalRows),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof DatasetNotFoundError) {
      return datasetNotFoundResponse(error);
    }
    return internalServerError(error, "Не удалось выполнить экспорт.");
  }
}

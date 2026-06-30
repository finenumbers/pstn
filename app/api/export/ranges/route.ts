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
import { EXPORT_ROW_MAX } from "@/lib/export/exportLimits";
import { API_ERROR_CODES } from "@/lib/api/apiErrorCodes";
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

    const parsedDataset = parseDatasetAndAsOf(params);
    if (isDatasetAndAsOfParseError(parsedDataset)) {
      return parsedDataset;
    }
    const { dataset, asOf } = parsedDataset;

    const totalRows = await countRanges(filtersParsed.data, dataset, asOf);
    if (totalRows > EXPORT_ROW_MAX) {
      return apiError(
        API_ERROR_CODES.EXPORT_TOO_LARGE,
        `Слишком много строк для экспорта (лимит ${EXPORT_ROW_MAX.toLocaleString("ru-RU")}, найдено ${totalRows.toLocaleString("ru-RU")}). Сузьте фильтры.`,
        400,
        { matched: totalRows, limit: EXPORT_ROW_MAX }
      );
    }

    const { body } = await createRangesXlsxExport(
      filtersParsed.data,
      totalRows,
      dataset,
      asOf
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
    return internalServerError(error, "Не удалось выполнить экспорт.");
  }
}

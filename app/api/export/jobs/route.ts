import { NextRequest, NextResponse } from "next/server";
import {
  filtersSchema,
  parseFiltersFromSearchParams,
} from "@/packages/shared/contracts/filters.schema";
import {
  isDatasetAndAsOfParseError,
  parseDatasetAndAsOf,
} from "@/lib/api/datasetAndAsOf";
import { DatasetNotFoundError } from "@/packages/db/errors/datasetErrors";
import { datasetNotFoundResponse } from "@/lib/api/datasetParam";
import { API_ERROR_CODES } from "@/lib/api/apiErrorCodes";
import {
  apiError,
  internalServerError,
  validationError,
} from "@/lib/api/errors";
import { startExportJob } from "@/packages/export/exportWorker";

export async function POST(request: NextRequest) {
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

    const result = await startExportJob({
      filters: filtersParsed.data,
      dataset,
      asOf,
    });

    if (result.status === "busy") {
      return apiError(
        API_ERROR_CODES.EXPORT_BUSY,
        "Уже выполняется другой экспорт. Дождитесь завершения или отмените его.",
        409,
        { jobId: result.jobId }
      );
    }

    return NextResponse.json(
      {
        jobId: result.jobId,
        status: result.status,
        totalRows: result.totalRows,
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof DatasetNotFoundError) {
      return datasetNotFoundResponse(error);
    }
    return internalServerError(error, "Не удалось запустить экспорт.");
  }
}

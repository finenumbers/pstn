import { NextResponse } from "next/server";
import {
  isAsOfParseError,
  parseAsOfFromSearchParams,
} from "@/lib/api/asOfParam";
import {
  isDatasetParseError,
  parseDatasetFromSearchParams,
} from "@/lib/api/datasetParam";
import { apiError } from "@/lib/api/errors";
import { API_ERROR_CODES } from "@/lib/api/apiErrorCodes";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";

export function parseDatasetAndAsOf(
  params: URLSearchParams
):
  | { dataset: DatasetRef; asOf: string | null }
  | NextResponse {
  const dataset = parseDatasetFromSearchParams(params);
  if (isDatasetParseError(dataset)) {
    return dataset;
  }

  const asOf = parseAsOfFromSearchParams(params);
  if (isAsOfParseError(asOf)) {
    return asOf;
  }

  if (dataset.kind !== "current" && asOf) {
    return apiError(
      API_ERROR_CODES.VALIDATION_ERROR,
      "Параметр asOf доступен только для текущего датасета.",
      400
    );
  }

  return { dataset, asOf };
}

export function isDatasetAndAsOfParseError(
  value: { dataset: DatasetRef; asOf: string | null } | NextResponse
): value is NextResponse {
  return value instanceof NextResponse;
}

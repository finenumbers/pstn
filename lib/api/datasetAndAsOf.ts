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
      "VALIDATION_ERROR",
      "asOf is only supported with dataset=current",
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

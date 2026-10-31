import { NextResponse } from "next/server";
import {
  isDatasetParseError,
  parseDatasetFromSearchParams,
} from "@/lib/api/datasetParam";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";

export function parseDatasetAndAsOf(
  params: URLSearchParams
): { dataset: DatasetRef } | NextResponse {
  const dataset = parseDatasetFromSearchParams(params);
  if (isDatasetParseError(dataset)) {
    return dataset;
  }
  return { dataset };
}

export function isDatasetAndAsOfParseError(
  value: { dataset: DatasetRef } | NextResponse
): value is NextResponse {
  return value instanceof NextResponse;
}

import { NextResponse } from "next/server";
import { DatasetNotFoundError } from "@/packages/db/errors/datasetErrors";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import {
  datasetNotFoundResponse,
  isDatasetParseError,
  parseDatasetFromSearchParams,
} from "@/lib/api/datasetParam";
import { internalServerError } from "@/lib/api/errors";

export { isDatasetParseError } from "@/lib/api/datasetParam";

export function parseDatasetOrError(
  params: URLSearchParams
): DatasetRef | NextResponse {
  return parseDatasetFromSearchParams(params);
}

export async function runDatasetQuery<T>(
  params: URLSearchParams,
  fn: (dataset: DatasetRef) => Promise<T>
): Promise<T | NextResponse> {
  const dataset = parseDatasetOrError(params);
  if (isDatasetParseError(dataset)) {
    return dataset;
  }

  try {
    return await fn(dataset);
  } catch (error) {
    if (error instanceof DatasetNotFoundError) {
      return datasetNotFoundResponse(error);
    }
    return internalServerError(error);
  }
}

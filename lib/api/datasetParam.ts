import { NextResponse } from "next/server";
import { DatasetNotFoundError } from "@/packages/db/errors/datasetErrors";
import {
  tryParseDatasetParam,
  type DatasetRef,
} from "@/packages/shared/contracts/dataset.schema";
import { validationError } from "@/lib/api/errors";

export function parseDatasetFromSearchParams(
  params: URLSearchParams
): DatasetRef | NextResponse {
  const parsed = tryParseDatasetParam(params.get("dataset"));
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  return parsed.data;
}

export function isDatasetParseError(
  value: DatasetRef | NextResponse
): value is NextResponse {
  return value instanceof NextResponse;
}

export function datasetNotFoundResponse(error: DatasetNotFoundError): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "DATASET_NOT_FOUND",
        message: error.message,
        details: { snapshotId: error.snapshotId },
      },
    },
    { status: 404 }
  );
}

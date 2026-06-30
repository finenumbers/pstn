import { NextResponse } from "next/server";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import { parseDatasetFromSearchParams } from "@/lib/api/datasetParam";

export { isDatasetParseError } from "@/lib/api/datasetParam";

export function parseDatasetOrError(
  params: URLSearchParams
): DatasetRef | NextResponse {
  return parseDatasetFromSearchParams(params);
}

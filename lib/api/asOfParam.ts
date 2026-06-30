import { NextResponse } from "next/server";
import { tryParseAsOfParam } from "@/packages/shared/contracts/dataset.schema";
import { validationError } from "@/lib/api/errors";

export function parseAsOfFromSearchParams(
  params: URLSearchParams
): string | null | NextResponse {
  const parsed = tryParseAsOfParam(params.get("asOf"));
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  return parsed.data;
}

export function isAsOfParseError(
  value: string | null | NextResponse
): value is NextResponse {
  return value instanceof NextResponse;
}

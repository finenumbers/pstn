import { type FiltersDTO, filtersToSearchParams } from "@/packages/shared/contracts/filters.schema";
import { ApiClientError } from "@/lib/api/apiClientError";
import { mapApiError, type MappedApiError } from "@/lib/api/mapApiError";

async function throwApiClientError(
  res: Response,
  body: unknown
): Promise<never> {
  const mapped = mapApiError(
    res.status,
    body,
    res.headers.get("Retry-After")
  );
  throw new ApiClientError(res.status, mapped.userMessage, {
    code: mapped.code,
    retryAfterSec: mapped.retryAfterSec,
  });
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return throwApiClientError(res, body);
  }
  return res.json() as Promise<T>;
}

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return throwApiClientError(res, data);
  }
  return res.json() as Promise<T>;
}

export function buildFilterParams(filters: FiltersDTO): URLSearchParams {
  return filtersToSearchParams(filters);
}

/** Map export fetch errors the same way as fetchJson. */
export async function mapFetchResponseError(
  res: Response
): Promise<MappedApiError> {
  const body = await res.json().catch(() => ({}));
  return mapApiError(res.status, body, res.headers.get("Retry-After"));
}

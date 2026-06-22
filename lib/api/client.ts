import { type FiltersDTO, filtersToSearchParams } from "@/packages/shared/contracts/filters.schema";

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: { message?: string } }).error?.message ??
        `Request failed: ${res.status}`
    );
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
    throw new Error(
      (data as { error?: { message?: string } }).error?.message ??
        `Request failed: ${res.status}`
    );
  }
  return res.json() as Promise<T>;
}

export function buildFilterParams(filters: FiltersDTO): URLSearchParams {
  return filtersToSearchParams(filters);
}

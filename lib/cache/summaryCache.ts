import { normalizeFilters, type FiltersDTO } from "@/packages/shared/contracts/filters.schema";

const SUMMARY_CACHE_TTL_MS = 60_000;
const SUMMARY_CACHE_MAX_ENTRIES = 128;

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const summaryCache = new Map<string, CacheEntry<unknown>>();

function summaryCacheKey(filters: FiltersDTO): string {
  return JSON.stringify(normalizeFilters(filters));
}

export function getCachedSummary<T>(filters: FiltersDTO): T | undefined {
  const key = summaryCacheKey(filters);
  const entry = summaryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    summaryCache.delete(key);
    return undefined;
  }
  return entry.value;
}

export function setCachedSummary<T>(filters: FiltersDTO, value: T): void {
  const key = summaryCacheKey(filters);
  if (summaryCache.size >= SUMMARY_CACHE_MAX_ENTRIES) {
    const oldestKey = summaryCache.keys().next().value;
    if (oldestKey) summaryCache.delete(oldestKey);
  }
  summaryCache.set(key, {
    value,
    expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
  });
}

export function clearSummaryCache(): void {
  summaryCache.clear();
}

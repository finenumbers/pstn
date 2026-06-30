import {
  datasetQueryKey,
  type DatasetRef,
} from "@/packages/shared/contracts/dataset.schema";
import { normalizeFilters, type FiltersDTO } from "@/packages/shared/contracts/filters.schema";

const SUMMARY_CACHE_TTL_MS = 60_000;
const SUMMARY_CACHE_MAX_ENTRIES = 128;

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const summaryCache = new Map<string, CacheEntry<unknown>>();

function summaryCacheKey(
  filters: FiltersDTO,
  dataset?: DatasetRef,
  asOf?: string | null
): string {
  const datasetKey = dataset
    ? datasetQueryKey(dataset, asOf)
    : asOf
      ? `current?asOf=${asOf}`
      : "current";
  return `${datasetKey}:${JSON.stringify(normalizeFilters(filters))}`;
}

export function getCachedSummary<T>(
  filters: FiltersDTO,
  dataset?: DatasetRef,
  asOf?: string | null
): T | undefined {
  const key = summaryCacheKey(filters, dataset, asOf);
  const entry = summaryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    summaryCache.delete(key);
    return undefined;
  }
  return entry.value;
}

export function setCachedSummary<T>(
  filters: FiltersDTO,
  value: T,
  dataset?: DatasetRef,
  asOf?: string | null
): void {
  const key = summaryCacheKey(filters, dataset, asOf);
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

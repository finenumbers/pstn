/**
 * Client-side URL parsing for `/ranges` (browser history, share links).
 *
 * Intentionally **lenient**: an invalid `dataset` falls back to current
 * so the page stays usable. `asOf` is ignored and stripped by the page.
 * Strict API validation lives in `lib/api/datasetParam.ts` (400 on bad input).
 */
import {
  DEFAULT_SORT,
  filtersToSearchParams,
  parseFiltersFromSearchParams,
  parseSortParam,
  type FiltersDTO,
  type SortableColumn,
} from "@/packages/shared/contracts/filters.schema";
import {
  DATASET_CURRENT_ID,
  serializeDatasetParam,
  tryParseDatasetParam,
  type DatasetRef,
} from "@/packages/shared/contracts/dataset.schema";
import { normalizeRangesSort } from "@/lib/sort/normalizeRangesSort";
import type { RangesTableState } from "@/lib/table/rangesTableState";

/** Lenient UI parser — invalid param → current dataset (no error surface). */
export function parseDatasetFromSearchParams(
  params: URLSearchParams
): DatasetRef {
  const parsed = tryParseDatasetParam(params.get("dataset"));
  if (!parsed.success) {
    return { kind: "current" };
  }
  return parsed.data;
}

export function parseRangesTableFromSearchParams(
  params: URLSearchParams
): RangesTableState | null {
  const hasFilters = [...params.keys()].some((k) => k.startsWith("filters."));
  const hasSort = params.has("sort");

  if (!hasFilters && !hasSort) return null;

  return {
    filters: parseFiltersFromSearchParams(params),
    sorting: normalizeRangesSort(
      parseSortParam(params.get("sort") ?? undefined)
    ),
    pageSize: 50,
  };
}

export function buildRangesPageSearchParams(
  filters: FiltersDTO,
  sorting: { id: SortableColumn; desc: boolean }[],
  dataset: DatasetRef = { kind: "current" }
): URLSearchParams {
  const params = filtersToSearchParams(filters);
  const datasetParam = serializeDatasetParam(dataset);
  if (datasetParam !== DATASET_CURRENT_ID) {
    params.set("dataset", datasetParam);
  }
  const sortStr = sorting
    .map((s) => `${s.id}:${s.desc ? "desc" : "asc"}`)
    .join(",");
  const defaultStr = DEFAULT_SORT
    .map((s) => `${s.id}:${s.desc ? "desc" : "asc"}`)
    .join(",");
  if (sortStr !== defaultStr) {
    params.set("sort", sortStr);
  }
  return params;
}

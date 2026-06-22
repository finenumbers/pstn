import {
  DEFAULT_SORT,
  filtersToSearchParams,
  parseFiltersFromSearchParams,
  parseSortParam,
  type FiltersDTO,
  type SortableColumn,
} from "@/packages/shared/contracts/filters.schema";
import { normalizeRangesSort } from "@/lib/sort/normalizeRangesSort";
import type { RangesTableState } from "@/lib/table/rangesTableState";

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
  sorting: { id: SortableColumn; desc: boolean }[]
): URLSearchParams {
  const params = filtersToSearchParams(filters);
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

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
  tryParseAsOfParam,
  tryParseDatasetParam,
  type DatasetRef,
} from "@/packages/shared/contracts/dataset.schema";
import { normalizeRangesSort } from "@/lib/sort/normalizeRangesSort";
import type { RangesTableState } from "@/lib/table/rangesTableState";

export function parseDatasetFromSearchParams(
  params: URLSearchParams
): DatasetRef {
  const parsed = tryParseDatasetParam(params.get("dataset"));
  if (!parsed.success) {
    return { kind: "current" };
  }
  return parsed.data;
}

export function parseAsOfFromSearchParams(
  params: URLSearchParams
): string | null {
  const parsed = tryParseAsOfParam(params.get("asOf"));
  if (!parsed.success) {
    return null;
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
  dataset: DatasetRef = { kind: "current" },
  asOf?: string | null
): URLSearchParams {
  const params = filtersToSearchParams(filters);
  const datasetParam = serializeDatasetParam(dataset);
  if (datasetParam !== DATASET_CURRENT_ID) {
    params.set("dataset", datasetParam);
  }
  if (asOf && dataset.kind === "current") {
    params.set("asOf", asOf);
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

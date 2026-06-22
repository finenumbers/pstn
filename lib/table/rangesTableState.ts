import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  type FiltersDTO,
  type SortableColumn,
} from "@/packages/shared/contracts/filters.schema";
import { hasActiveFilters } from "@/lib/filters/hasActiveFilters";
import { normalizeRangesSort } from "@/lib/sort/normalizeRangesSort";

export const DEFAULT_PAGE_SIZE = 50;

export interface RangesTableState {
  filters: FiltersDTO;
  sorting: { id: SortableColumn; desc: boolean }[];
  pageSize: number;
}

export const initialTableState: RangesTableState = {
  filters: { ...DEFAULT_FILTERS },
  sorting: [...DEFAULT_SORT],
  pageSize: DEFAULT_PAGE_SIZE,
};

export type RangesTableAction =
  | { type: "SET_FILTER"; field: keyof FiltersDTO; value: FiltersDTO[keyof FiltersDTO] }
  | { type: "SET_FILTERS"; filters: FiltersDTO }
  | { type: "SET_SORTING"; sorting: { id: SortableColumn; desc: boolean }[] }
  | { type: "RESET_ALL" };

export function rangesTableReducer(
  state: RangesTableState,
  action: RangesTableAction
): RangesTableState {
  switch (action.type) {
    case "SET_FILTER":
      return {
        ...state,
        filters: { ...state.filters, [action.field]: action.value },
      };
    case "SET_FILTERS":
      return {
        ...state,
        filters: action.filters,
      };
    case "SET_SORTING":
      return { ...state, sorting: action.sorting };
    case "RESET_ALL":
      return { ...initialTableState };
    default:
      return state;
  }
}

export function isDefaultSort(
  sorting: { id: SortableColumn; desc: boolean }[]
): boolean {
  const normalized = normalizeRangesSort(sorting);
  const defaultNormalized = normalizeRangesSort(DEFAULT_SORT);
  if (normalized.length !== defaultNormalized.length) return false;
  return normalized.every(
    (item, index) =>
      item.id === defaultNormalized[index].id &&
      item.desc === defaultNormalized[index].desc
  );
}

/** Enable «Сбросить фильтры» when search, filters, sort, or scroll differ from default. */
export function canResetRangesTable(
  filters: FiltersDTO,
  loadedPageCount: number,
  sorting: { id: SortableColumn; desc: boolean }[] = DEFAULT_SORT
): boolean {
  return (
    hasActiveFilters(filters) ||
    loadedPageCount > 1 ||
    !isDefaultSort(sorting)
  );
}

import { z } from "zod";
import {
  isPhoneMaskEmpty,
  normalizePhoneMask,
  serializePhoneMask,
} from "@/lib/phoneNumberMask";

export const FACET_COLUMNS = ["abc", "operator", "settlement", "region"] as const;
export type FacetColumn = (typeof FACET_COLUMNS)[number];

export const SORTABLE_COLUMNS = [
  "abc",
  "rangeStart",
  "rangeEnd",
  "capacity",
  "operator",
  "settlement",
  "region",
  "inn",
] as const;
export type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

export const filtersSchema = z.object({
  abc: z.array(z.string()).default([]),
  operator: z.array(z.string()).default([]),
  settlement: z.array(z.string()).default([]),
  region: z.array(z.string()).default([]),
  inn: z.string().default(""),
  rangeStart: z.string().default(""),
  rangeEnd: z.string().default(""),
  capacity: z.string().default(""),
  phoneNumber: z.string().default(""),
});

export type FiltersDTO = z.infer<typeof filtersSchema>;

export const sortItemSchema = z.object({
  id: z.enum(SORTABLE_COLUMNS),
  desc: z.boolean(),
});

export const rangesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.string().optional(),
  cursor: z.string().min(1).optional(),
  filters: filtersSchema.optional(),
});

export const facetsQuerySchema = z.object({
  columns: z.string().optional(),
  search: z.record(z.string()).optional(),
  filters: filtersSchema.optional(),
});

export const summaryQuerySchema = z.object({
  filters: filtersSchema.optional(),
});

export const importStatusQuerySchema = z.object({
  jobId: z.string().uuid().optional(),
});

export interface NumberRangeRow {
  id: number;
  abc: string;
  rangeStart: number;
  rangeEnd: number;
  capacity: number;
  operator: string;
  settlement: string;
  region: string;
  inn: string;
  /** Red separator above: gap vs full-data predecessor in same ABC. */
  abcRangeGapBefore: boolean;
  /** Red separator below: gap vs full-data successor in same ABC. */
  abcRangeGapAfter: boolean;
}

/** Keyset cursor for infinite scroll (sort column values + id). */
export interface RangesCursor {
  id: number;
  abc: string;
  rangeStart: number;
  rangeEnd: number;
  capacity: number;
  operator: string;
  settlement: string;
  region: string;
  inn: string;
}

export interface RangesListResponse {
  data: NumberRangeRow[];
  meta: {
    pageSize: number;
    totalRows: number;
    hasMore: boolean;
    sort: { id: SortableColumn; desc: boolean }[];
  };
}

export interface FacetOption {
  value: string;
  count: number;
  selected: boolean;
  disabled?: boolean;
}

export interface FacetColumnResult {
  options: FacetOption[];
  totalDistinct: number;
}

export interface FacetsResponse {
  facets: Record<string, FacetColumnResult>;
}

export interface SummaryResponse {
  loadedAt: string | null;
  filtered: {
    rangeCount: number;
    totalCapacity: number;
    uniqueOperators: number;
  };
  global: {
    rangeCount: number;
    totalCapacity: number;
    uniqueOperators: number;
  };
}

export interface ImportProgress {
  phase: string;
  phaseLabel: string;
  percent: number;
  filesProcessed: number;
  filesTotal: number;
  rowsLoaded: number;
  files: ImportFileProgress[];
  steps: ImportStepProgress[];
}

export type ImportFileStatus = "pending" | "loading" | "done" | "failed";

export type ImportStepStatus = "pending" | "active" | "done";

export interface ImportFileProgress {
  key: string;
  status: ImportFileStatus;
  rows: number | null;
}

export interface ImportStepProgress {
  id: string;
  label: string;
  status: ImportStepStatus;
}

export interface ImportStatusResponse {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  progress?: ImportProgress;
  loadedAt: string | null;
  errorMessage?: string;
  rowsLoaded?: number;
}

export const DEFAULT_FILTERS: FiltersDTO = {
  abc: [],
  operator: [],
  settlement: [],
  region: [],
  inn: "",
  rangeStart: "",
  rangeEnd: "",
  capacity: "",
  phoneNumber: "",
};

export const DEFAULT_SORT: { id: SortableColumn; desc: boolean }[] = [
  { id: "abc", desc: false },
  { id: "rangeStart", desc: false },
];

export function normalizeFilters(filters: FiltersDTO): FiltersDTO {
  return {
    abc: [...filters.abc].sort(),
    operator: [...filters.operator].sort(),
    settlement: [...filters.settlement].sort(),
    region: [...filters.region].sort(),
    inn: filters.inn.trim(),
    rangeStart: filters.rangeStart.trim(),
    rangeEnd: filters.rangeEnd.trim(),
    capacity: filters.capacity.trim(),
    phoneNumber: isPhoneMaskEmpty(filters.phoneNumber)
      ? ""
      : serializePhoneMask(normalizePhoneMask(filters.phoneNumber)),
  };
}

export function parseSortParam(
  sort?: string
): { id: SortableColumn; desc: boolean }[] {
  if (!sort) return DEFAULT_SORT;
  const items = sort.split(",").map((part) => {
    const [id, dir] = part.split(":");
    const column = SORTABLE_COLUMNS.find((c) => c === id);
    if (!column) return null;
    return { id: column, desc: dir === "desc" };
  });
  const valid = items.filter(Boolean) as { id: SortableColumn; desc: boolean }[];
  return valid.length > 0 ? valid : DEFAULT_SORT;
}

export function serializeSort(
  sort: { id: SortableColumn; desc: boolean }[]
): string {
  return sort.map((s) => `${s.id}:${s.desc ? "desc" : "asc"}`).join(",");
}

export function parseFiltersFromSearchParams(
  params: URLSearchParams
): FiltersDTO {
  const getArray = (key: string) => {
    const val = params.get(`filters.${key}`);
    if (val === null) return [];
    return val.split("|||");
  };
  return normalizeFilters({
    abc: getArray("abc"),
    operator: getArray("operator"),
    settlement: getArray("settlement"),
    region: getArray("region"),
    inn: params.get("filters.inn") ?? "",
    rangeStart: params.get("filters.rangeStart") ?? "",
    rangeEnd: params.get("filters.rangeEnd") ?? "",
    capacity: params.get("filters.capacity") ?? "",
    phoneNumber: params.get("filters.phoneNumber") ?? "",
  });
}

export function filtersToSearchParams(filters: FiltersDTO): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.abc.length) params.set("filters.abc", filters.abc.join("|||"));
  if (filters.operator.length)
    params.set("filters.operator", filters.operator.join("|||"));
  if (filters.settlement.length)
    params.set("filters.settlement", filters.settlement.join("|||"));
  if (filters.region.length)
    params.set("filters.region", filters.region.join("|||"));
  if (filters.inn) params.set("filters.inn", filters.inn);
  if (filters.rangeStart) params.set("filters.rangeStart", filters.rangeStart);
  if (filters.rangeEnd) params.set("filters.rangeEnd", filters.rangeEnd);
  if (filters.capacity) params.set("filters.capacity", filters.capacity);
  if (filters.phoneNumber) params.set("filters.phoneNumber", filters.phoneNumber);
  return params;
}

import type {
  FiltersDTO,
  RangesCursor,
  SortableColumn,
} from "@/packages/shared/contracts/filters.schema";
import { parsePhoneNumberMask } from "@/lib/phoneNumberMask";
import {
  asc,
  count,
  countDistinct,
  desc,
  eq,
  type SQL,
  sum,
} from "drizzle-orm";
import { db } from "../index";
import { datasetMeta, numberRanges } from "../schema";
import { buildWhere } from "./buildWhere";
import { hasActiveFilters } from "@/lib/filters/hasActiveFilters";
import { phoneNumberPartialMatchCountExpr } from "./phoneNumberMatchCount";
import {
  buildKeysetWhere,
  mergeKeysetWhere,
} from "./rangesKeyset";

const COLUMN_MAP = {
  abc: numberRanges.abc,
  rangeStart: numberRanges.rangeStart,
  rangeEnd: numberRanges.rangeEnd,
  capacity: numberRanges.capacity,
  operator: numberRanges.operator,
  settlement: numberRanges.settlement,
  region: numberRanges.region,
  inn: numberRanges.inn,
} as const;

export function buildOrderBy(sort: { id: string; desc: boolean }[]): SQL[] {
  return sort.map((s) => {
    const col = COLUMN_MAP[s.id as keyof typeof COLUMN_MAP];
    return s.desc ? desc(col) : asc(col);
  });
}

function buildTailOrderBy(sort: { id: string; desc: boolean }[]): SQL[] {
  const hasRangeStart = sort.some((s) => s.id === "rangeStart");
  const allDesc = sort.every((s) => s.desc);
  const tail: SQL[] = [];
  if (!hasRangeStart) {
    tail.push(asc(numberRanges.rangeStart));
  }
  tail.push(allDesc ? desc(numberRanges.id) : asc(numberRanges.id));
  return tail;
}

export async function listRanges(params: {
  filters: FiltersDTO;
  sort: { id: string; desc: boolean }[];
  pageSize: number;
  cursor?: RangesCursor | null;
  page?: number;
}) {
  const baseWhere = buildWhere(params.filters);
  const orderBy = buildOrderBy(params.sort);
  const keysetWhere = params.cursor
    ? buildKeysetWhere(
        params.sort as { id: SortableColumn; desc: boolean }[],
        params.cursor
      )
    : undefined;
  const where = mergeKeysetWhere(baseWhere, keysetWhere);

  const useOffset = !keysetWhere && params.page && params.page > 1;
  const offset = useOffset ? (params.page! - 1) * params.pageSize : 0;
  const tailOrder = buildTailOrderBy(params.sort);

  const dataQuery = db
    .select({
      id: numberRanges.id,
      abc: numberRanges.abc,
      rangeStart: numberRanges.rangeStart,
      rangeEnd: numberRanges.rangeEnd,
      capacity: numberRanges.capacity,
      operator: numberRanges.operator,
      settlement: numberRanges.settlement,
      region: numberRanges.region,
      inn: numberRanges.inn,
      abcRangeGapBefore: numberRanges.abcGapBefore,
      abcRangeGapAfter: numberRanges.abcGapAfter,
    })
    .from(numberRanges)
    .where(where)
    .orderBy(...orderBy, ...tailOrder)
    .limit(params.pageSize)
    .offset(useOffset ? offset : 0);

  const [totalRows, data] = await Promise.all([
    params.cursor ? Promise.resolve(0) : countRanges(params.filters),
    dataQuery,
  ]);

  return {
    data,
    totalRows,
    hasMore: data.length === params.pageSize,
  };
}

export async function countRanges(filters: FiltersDTO): Promise<number> {
  if (!hasActiveFilters(filters)) {
    const metaRows = await db
      .select({ totalRows: datasetMeta.totalRows })
      .from(datasetMeta)
      .where(eq(datasetMeta.id, 1));
    const cachedTotal = metaRows[0]?.totalRows;
    if (cachedTotal != null) {
      return cachedTotal;
    }
  }

  const where = buildWhere(filters);
  const result = await db
    .select({ total: count() })
    .from(numberRanges)
    .where(where);
  return Number(result[0]?.total ?? 0);
}

async function loadGlobalSummaryFromTable(): Promise<{
  rangeCount: number;
  totalCapacity: number;
  uniqueOperators: number;
}> {
  const globalResult = await db
    .select({
      rangeCount: count(),
      totalCapacity: sum(numberRanges.capacity),
      uniqueOperators: countDistinct(numberRanges.operator),
    })
    .from(numberRanges);
  const global = globalResult[0];
  return {
    rangeCount: Number(global?.rangeCount ?? 0),
    totalCapacity: Number(global?.totalCapacity ?? 0),
    uniqueOperators: Number(global?.uniqueOperators ?? 0),
  };
}

function globalSummaryFromMeta(
  metaRow: typeof datasetMeta.$inferSelect | undefined
): {
  rangeCount: number;
  totalCapacity: number;
  uniqueOperators: number;
} | null {
  if (
    metaRow?.totalRows == null ||
    metaRow.totalCapacity == null ||
    metaRow.uniqueOperators == null
  ) {
    return null;
  }

  return {
    rangeCount: metaRow.totalRows,
    totalCapacity: Number(metaRow.totalCapacity),
    uniqueOperators: metaRow.uniqueOperators,
  };
}

export async function summaryRanges(filters: FiltersDTO) {
  const metaRows = await db
    .select()
    .from(datasetMeta)
    .where(eq(datasetMeta.id, 1));
  const metaRow = metaRows[0];

  if (!hasActiveFilters(filters)) {
    const globalFromMeta = globalSummaryFromMeta(metaRow);
    const global = globalFromMeta ?? (await loadGlobalSummaryFromTable());

    return {
      loadedAt: metaRow?.lastSuccessAt?.toISOString() ?? null,
      filtered: {
        rangeCount: global.rangeCount,
        totalCapacity: global.totalCapacity,
        uniqueOperators: global.uniqueOperators,
      },
      global,
    };
  }

  const filteredWhere = buildWhere(filters);
  const phoneParts = filters.phoneNumber
    ? parsePhoneNumberMask(filters.phoneNumber)
    : null;

  const filteredCapacityExpr = phoneParts
    ? phoneNumberPartialMatchCountExpr(phoneParts)
    : numberRanges.capacity;

  const filteredResult = await db
    .select({
      rangeCount: count(),
      totalCapacity: sum(filteredCapacityExpr),
      uniqueOperators: countDistinct(numberRanges.operator),
    })
    .from(numberRanges)
    .where(filteredWhere);

  const filtered = filteredResult[0];
  const globalFromMeta = globalSummaryFromMeta(metaRow);
  const global =
    globalFromMeta ?? (await loadGlobalSummaryFromTable());

  return {
    loadedAt: metaRow?.lastSuccessAt?.toISOString() ?? null,
    filtered: {
      rangeCount: Number(filtered?.rangeCount ?? 0),
      totalCapacity: Number(filtered?.totalCapacity ?? 0),
      uniqueOperators: Number(filtered?.uniqueOperators ?? 0),
    },
    global: {
      rangeCount: global.rangeCount,
      totalCapacity: global.totalCapacity,
      uniqueOperators: global.uniqueOperators,
    },
  };
}

export async function listRangesForExport(
  filters: FiltersDTO,
  limit: number,
  cursor?: RangesCursor | null
) {
  const baseWhere = buildWhere(filters);
  const keysetWhere = cursor
    ? buildKeysetWhere(
        [
          { id: "abc", desc: false },
          { id: "rangeStart", desc: false },
        ],
        cursor
      )
    : undefined;
  const where = mergeKeysetWhere(baseWhere, keysetWhere);

  return db
    .select({
      id: numberRanges.id,
      abc: numberRanges.abc,
      rangeStart: numberRanges.rangeStart,
      rangeEnd: numberRanges.rangeEnd,
      capacity: numberRanges.capacity,
      operator: numberRanges.operator,
      settlement: numberRanges.settlement,
      region: numberRanges.region,
      inn: numberRanges.inn,
      abcRangeGapBefore: numberRanges.abcGapBefore,
      abcRangeGapAfter: numberRanges.abcGapAfter,
    })
    .from(numberRanges)
    .where(where)
    .orderBy(
      asc(numberRanges.abc),
      asc(numberRanges.rangeStart),
      asc(numberRanges.id)
    )
    .limit(limit);
}

export async function countRangesForExport(filters: FiltersDTO): Promise<number> {
  return countRanges(filters);
}

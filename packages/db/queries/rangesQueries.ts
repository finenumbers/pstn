import type { FiltersDTO, RangesCursor, SortableColumn } from "@/packages/shared/contracts/filters.schema";
import { getCachedSummary, setCachedSummary } from "@/lib/cache/summaryCache";
import { hasActiveFilters } from "@/lib/filters/hasActiveFilters";
import { PHONE_CAPACITY_SUMMARY_LIMIT } from "@/lib/filters/phoneSearchLimits";
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
import { datasetMeta, numberRanges, operatorsRegister } from "../schema";
import { innRegisterMatchSql } from "./innRegisterMatch";
import { buildWhere } from "./buildWhere";
import { getUvrAntifraudBindingCached } from "./refreshUvrAntifraudBinding";
import { phoneNumberPartialMatchCountExpr } from "./phoneNumberMatchCount";
import {
  buildKeysetWhere,
  mergeKeysetWhere,
} from "./rangesKeyset";

export type SummaryRangesResult = {
  loadedAt: string | null;
  filtered: {
    rangeCount: number;
    totalCapacity: number;
    totalCapacityPending?: boolean;
    uniqueRegions: number;
    uniqueGarTerritories: number;
    uniqueOperators: number;
  };
  global: {
    rangeCount: number;
    totalCapacity: number;
    uniqueRegions: number;
    uniqueGarTerritories: number;
    uniqueOperators: number;
  };
  uvrBinding: {
    registryOperators: number;
    matchedDistinctInns: number;
  };
};

const COLUMN_MAP = {
  abc: numberRanges.abc,
  rangeStart: numberRanges.rangeStart,
  rangeEnd: numberRanges.rangeEnd,
  capacity: numberRanges.capacity,
  operator: numberRanges.operator,
  garTerritory: numberRanges.garTerritory,
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
  skipCount?: boolean;
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
      garTerritory: numberRanges.garTerritory,
      region: numberRanges.region,
      inn: numberRanges.inn,
      uvrAntifraud: operatorsRegister.idSrc,
      abcRangeGapBefore: numberRanges.abcGapBefore,
      abcRangeGapAfter: numberRanges.abcGapAfter,
    })
    .from(numberRanges)
    .leftJoin(operatorsRegister, innRegisterMatchSql())
    .where(where)
    .orderBy(...orderBy, ...tailOrder)
    .limit(params.pageSize)
    .offset(useOffset ? offset : 0);

  const resolveTotalRows = (): Promise<number> => {
    if (params.cursor) return Promise.resolve(0);
    if (params.skipCount) return Promise.resolve(-1);
    return countRanges(params.filters);
  };

  const [totalRows, data] = await Promise.all([
    resolveTotalRows(),
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
  uniqueRegions: number;
  uniqueGarTerritories: number;
  uniqueOperators: number;
}> {
  const globalResult = await db
    .select({
      rangeCount: count(),
      totalCapacity: sum(numberRanges.capacity),
      uniqueRegions: countDistinct(numberRanges.region),
      uniqueGarTerritories: countDistinct(numberRanges.garTerritory),
      uniqueOperators: countDistinct(numberRanges.operator),
    })
    .from(numberRanges);
  const global = globalResult[0];
  return {
    rangeCount: Number(global?.rangeCount ?? 0),
    totalCapacity: Number(global?.totalCapacity ?? 0),
    uniqueRegions: Number(global?.uniqueRegions ?? 0),
    uniqueGarTerritories: Number(global?.uniqueGarTerritories ?? 0),
    uniqueOperators: Number(global?.uniqueOperators ?? 0),
  };
}

function globalSummaryFromMeta(
  metaRow: typeof datasetMeta.$inferSelect | undefined
): {
  rangeCount: number;
  totalCapacity: number;
  uniqueRegions: number;
  uniqueGarTerritories: number;
  uniqueOperators: number;
} | null {
  if (
    metaRow?.totalRows == null ||
    metaRow.totalCapacity == null ||
    metaRow.uniqueOperators == null ||
    metaRow.uniqueRegions == null ||
    metaRow.uniqueGarTerritories == null
  ) {
    return null;
  }

  return {
    rangeCount: metaRow.totalRows,
    totalCapacity: Number(metaRow.totalCapacity),
    uniqueRegions: metaRow.uniqueRegions,
    uniqueGarTerritories: metaRow.uniqueGarTerritories,
    uniqueOperators: metaRow.uniqueOperators,
  };
}

export async function summaryRanges(
  filters: FiltersDTO
): Promise<SummaryRangesResult> {
  const cached = getCachedSummary<SummaryRangesResult>(filters);
  if (cached) {
    return cached;
  }

  const metaRows = await db
    .select()
    .from(datasetMeta)
    .where(eq(datasetMeta.id, 1));
  const metaRow = metaRows[0];
  const uvrBinding = await getUvrAntifraudBindingCached();

  if (!hasActiveFilters(filters)) {
    const globalFromMeta = globalSummaryFromMeta(metaRow);
    const global = globalFromMeta ?? (await loadGlobalSummaryFromTable());

    const result = {
      loadedAt: metaRow?.lastSuccessAt?.toISOString() ?? null,
      filtered: {
        rangeCount: global.rangeCount,
        totalCapacity: global.totalCapacity,
        uniqueRegions: global.uniqueRegions,
        uniqueGarTerritories: global.uniqueGarTerritories,
        uniqueOperators: global.uniqueOperators,
      },
      global,
      uvrBinding,
    };
    setCachedSummary(filters, result);
    return result;
  }

  const filteredWhere = buildWhere(filters);
  const phoneParts = filters.phoneNumber
    ? parsePhoneNumberMask(filters.phoneNumber)
    : null;

  const filteredResult = await db
    .select({
      rangeCount: count(),
      uniqueRegions: countDistinct(numberRanges.region),
      uniqueGarTerritories: countDistinct(numberRanges.garTerritory),
      uniqueOperators: countDistinct(numberRanges.operator),
    })
    .from(numberRanges)
    .where(filteredWhere);

  const filtered = filteredResult[0];
  const rangeCount = Number(filtered?.rangeCount ?? 0);

  let totalCapacity = 0;
  let totalCapacityPending = false;

  if (phoneParts) {
    if (rangeCount > PHONE_CAPACITY_SUMMARY_LIMIT) {
      totalCapacityPending = true;
    } else {
      const capacityResult = await db
        .select({
          totalCapacity: sum(phoneNumberPartialMatchCountExpr(phoneParts)),
        })
        .from(numberRanges)
        .where(filteredWhere);
      totalCapacity = Number(capacityResult[0]?.totalCapacity ?? 0);
    }
  } else {
    const capacityResult = await db
      .select({
        totalCapacity: sum(numberRanges.capacity),
      })
      .from(numberRanges)
      .where(filteredWhere);
    totalCapacity = Number(capacityResult[0]?.totalCapacity ?? 0);
  }

  const globalFromMeta = globalSummaryFromMeta(metaRow);
  const global =
    globalFromMeta ?? (await loadGlobalSummaryFromTable());

  const result = {
    loadedAt: metaRow?.lastSuccessAt?.toISOString() ?? null,
    filtered: {
      rangeCount,
      totalCapacity,
      totalCapacityPending,
      uniqueRegions: Number(filtered?.uniqueRegions ?? 0),
      uniqueGarTerritories: Number(filtered?.uniqueGarTerritories ?? 0),
      uniqueOperators: Number(filtered?.uniqueOperators ?? 0),
    },
    global: {
      rangeCount: global.rangeCount,
      totalCapacity: global.totalCapacity,
      uniqueRegions: global.uniqueRegions,
      uniqueGarTerritories: global.uniqueGarTerritories,
      uniqueOperators: global.uniqueOperators,
    },
    uvrBinding,
  };
  setCachedSummary(filters, result);
  return result;
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
      garTerritory: numberRanges.garTerritory,
      region: numberRanges.region,
      inn: numberRanges.inn,
      uvrAntifraud: operatorsRegister.idSrc,
      abcRangeGapBefore: numberRanges.abcGapBefore,
      abcRangeGapAfter: numberRanges.abcGapAfter,
    })
    .from(numberRanges)
    .leftJoin(operatorsRegister, innRegisterMatchSql())
    .where(where)
    .orderBy(
      asc(numberRanges.abc),
      asc(numberRanges.rangeStart),
      asc(numberRanges.id)
    )
    .limit(limit);
}

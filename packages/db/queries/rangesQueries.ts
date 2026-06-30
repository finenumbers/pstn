import type { FiltersDTO, RangesCursor, SortableColumn } from "@/packages/shared/contracts/filters.schema";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
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
  sql,
  type SQL,
  sum,
} from "drizzle-orm";
import { db } from "../index";
import {
  datasetMeta,
  datasetSnapshots,
  numberRangeDiffs,
  numberRangeFullSnapshots,
  numberRanges,
  operatorsRegister,
} from "../schema";
import { innRegisterMatchSql } from "./innRegisterMatch";
import { buildWhere } from "./buildWhere";
import {
  CURRENT_RANGE_CONTEXT,
  resolveRangeQueryContext,
  type RangeQueryContext,
} from "./datasetContext";
import { getSnapshotLoadDate } from "./datasetsQueries";
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

function getColumnMap(context: RangeQueryContext) {
  const table = context.table;
  return {
    abc: table.abc,
    rangeStart: table.rangeStart,
    rangeEnd: table.rangeEnd,
    capacity: table.capacity,
    operator: table.operator,
    garTerritory: table.garTerritory,
    region: table.region,
    inn: table.inn,
  } as const;
}

export function buildOrderBy(
  context: RangeQueryContext,
  sort: { id: string; desc: boolean }[]
): SQL[] {
  const columns = getColumnMap(context);
  return sort.map((s) => {
    const col = columns[s.id as keyof typeof columns];
    return s.desc ? desc(col) : asc(col);
  });
}

function buildTailOrderBy(
  context: RangeQueryContext,
  sort: { id: string; desc: boolean }[]
): SQL[] {
  const table = context.table;
  const hasRangeStart = sort.some((s) => s.id === "rangeStart");
  const allDesc = sort.every((s) => s.desc);
  const tail: SQL[] = [];
  if (!hasRangeStart) {
    tail.push(asc(table.rangeStart));
  }
  tail.push(allDesc ? desc(table.id) : asc(table.id));
  return tail;
}

export async function listRanges(params: {
  filters: FiltersDTO;
  sort: { id: string; desc: boolean }[];
  pageSize: number;
  cursor?: RangesCursor | null;
  page?: number;
  skipCount?: boolean;
  dataset?: DatasetRef;
  asOf?: string | null;
}) {
  const context = params.dataset
    ? await resolveRangeQueryContext(params.dataset, params.asOf)
    : params.asOf
      ? await resolveRangeQueryContext({ kind: "current" }, params.asOf)
      : CURRENT_RANGE_CONTEXT;
  const table = context.table;
  const baseWhere = buildWhere(params.filters, context);
  const orderBy = buildOrderBy(context, params.sort);
  const keysetWhere = params.cursor
    ? buildKeysetWhere(
        table,
        params.sort as { id: SortableColumn; desc: boolean }[],
        params.cursor
      )
    : undefined;
  const where = mergeKeysetWhere(baseWhere, keysetWhere);

  const useOffset = !keysetWhere && params.page && params.page > 1;
  const offset = useOffset ? (params.page! - 1) * params.pageSize : 0;
  const tailOrder = buildTailOrderBy(context, params.sort);

  const dataQuery = db
    .select({
      id: table.id,
      abc: table.abc,
      rangeStart: table.rangeStart,
      rangeEnd: table.rangeEnd,
      capacity: table.capacity,
      operator: table.operator,
      garTerritory: table.garTerritory,
      region: table.region,
      inn: table.inn,
      uvrAntifraud: operatorsRegister.idSrc,
      abcRangeGapBefore: context.isDiff
        ? sql<boolean>`false`
        : context.isFull
          ? numberRangeFullSnapshots.abcGapBefore
          : numberRanges.abcGapBefore,
      abcRangeGapAfter: context.isDiff
        ? sql<boolean>`false`
        : context.isFull
          ? numberRangeFullSnapshots.abcGapAfter
          : numberRanges.abcGapAfter,
      changeType: context.isDiff ? numberRangeDiffs.changeType : sql<null>`null`,
      prevOperator: context.isDiff ? numberRangeDiffs.prevOperator : sql<null>`null`,
      prevInn: context.isDiff ? numberRangeDiffs.prevInn : sql<null>`null`,
      prevRegion: context.isDiff ? numberRangeDiffs.prevRegion : sql<null>`null`,
      prevGarTerritory: context.isDiff
        ? numberRangeDiffs.prevGarTerritory
        : sql<null>`null`,
    })
    .from(table)
    .leftJoin(operatorsRegister, innRegisterMatchSql(table.inn))
    .where(where)
    .orderBy(...orderBy, ...tailOrder)
    .limit(params.pageSize)
    .offset(useOffset ? offset : 0);

  const resolveTotalRows = (): Promise<number> => {
    if (params.cursor) return Promise.resolve(0);
    if (params.skipCount) return Promise.resolve(-1);
    return countRanges(params.filters, params.dataset, params.asOf);
  };

  const [totalRows, data] = await Promise.all([
    resolveTotalRows(),
    dataQuery,
  ]);

  return {
    data: data.map((row) => ({
      ...row,
      changeType: row.changeType as "added" | "changed" | "removed" | null | undefined,
      prevOperator: context.isDiff ? row.prevOperator ?? null : undefined,
      prevInn: context.isDiff ? row.prevInn ?? null : undefined,
      prevRegion: context.isDiff ? row.prevRegion ?? null : undefined,
      prevGarTerritory: context.isDiff ? row.prevGarTerritory ?? null : undefined,
      abcRangeGapBefore: context.isDiff ? false : Boolean(row.abcRangeGapBefore),
      abcRangeGapAfter: context.isDiff ? false : Boolean(row.abcRangeGapAfter),
    })),
    totalRows,
    hasMore: data.length === params.pageSize,
  };
}

export async function countRanges(
  filters: FiltersDTO,
  dataset?: DatasetRef,
  asOf?: string | null
): Promise<number> {
  const context = dataset
    ? await resolveRangeQueryContext(dataset, asOf)
    : asOf
      ? await resolveRangeQueryContext({ kind: "current" }, asOf)
      : CURRENT_RANGE_CONTEXT;

  if (!context.isDiff && !context.isFull && !hasActiveFilters(filters)) {
    const metaRows = await db
      .select({ totalRows: datasetMeta.totalRows })
      .from(datasetMeta)
      .where(eq(datasetMeta.id, 1));
    const cachedTotal = metaRows[0]?.totalRows;
    if (cachedTotal != null) {
      return cachedTotal;
    }
  }

  if (context.isFull && context.snapshotId && !hasActiveFilters(filters)) {
    const rows = await db
      .select({ rowCount: datasetSnapshots.rowCount })
      .from(datasetSnapshots)
      .where(eq(datasetSnapshots.id, context.snapshotId))
      .limit(1);
    const cachedTotal = rows[0]?.rowCount;
    if (cachedTotal != null && cachedTotal > 0) {
      return cachedTotal;
    }
  }

  const where = buildWhere(filters, context);
  const result = await db
    .select({ total: count() })
    .from(context.table)
    .where(where);
  return Number(result[0]?.total ?? 0);
}

async function loadGlobalSummaryFromTable(
  context: RangeQueryContext
): Promise<{
  rangeCount: number;
  totalCapacity: number;
  uniqueRegions: number;
  uniqueGarTerritories: number;
  uniqueOperators: number;
}> {
  const table = context.table;
  const snapshotWhere =
    context.isDiff && context.snapshotId
      ? eq(numberRangeDiffs.snapshotId, context.snapshotId)
      : context.isFull && context.snapshotId
        ? eq(numberRangeFullSnapshots.snapshotId, context.snapshotId)
        : undefined;
  const globalResult = await db
    .select({
      rangeCount: count(),
      totalCapacity: sum(table.capacity),
      uniqueRegions: countDistinct(table.region),
      uniqueGarTerritories: countDistinct(table.garTerritory),
      uniqueOperators: countDistinct(table.operator),
    })
    .from(table)
    .where(snapshotWhere);
  const global = globalResult[0];
  return {
    rangeCount: Number(global?.rangeCount ?? 0),
    totalCapacity: Number(global?.totalCapacity ?? 0),
    uniqueRegions: Number(global?.uniqueRegions ?? 0),
    uniqueGarTerritories: Number(global?.uniqueGarTerritories ?? 0),
    uniqueOperators: Number(global?.uniqueOperators ?? 0),
  };
}

async function loadFullGlobalFromSnapshot(snapshotId: string) {
  const rows = await db
    .select()
    .from(datasetSnapshots)
    .where(eq(datasetSnapshots.id, snapshotId))
    .limit(1);
  const snapshot = rows[0];
  if (!snapshot) {
    return loadGlobalSummaryFromTable({
      table: numberRangeFullSnapshots,
      snapshotId,
      isDiff: false,
      isFull: true,
    });
  }

  const tableStats = await loadGlobalSummaryFromTable({
    table: numberRangeFullSnapshots,
    snapshotId,
    isDiff: false,
    isFull: true,
  });

  return {
    rangeCount: snapshot.rowCount || tableStats.rangeCount,
    totalCapacity: tableStats.totalCapacity,
    uniqueRegions: tableStats.uniqueRegions,
    uniqueGarTerritories: tableStats.uniqueGarTerritories,
    uniqueOperators: tableStats.uniqueOperators,
  };
}

async function loadDiffGlobalFromSnapshot(snapshotId: string) {
  const rows = await db
    .select()
    .from(datasetSnapshots)
    .where(eq(datasetSnapshots.id, snapshotId))
    .limit(1);
  const snapshot = rows[0];
  if (!snapshot) {
    return loadGlobalSummaryFromTable({
      table: numberRangeDiffs,
      snapshotId,
      isDiff: true,
      isFull: false,
    });
  }

  const rangeCount =
    snapshot.addedCount + snapshot.changedCount + snapshot.removedCount;
  const tableStats = await loadGlobalSummaryFromTable({
    table: numberRangeDiffs,
    snapshotId,
    isDiff: true,
    isFull: false,
  });

  return {
    rangeCount,
    totalCapacity: tableStats.totalCapacity,
    uniqueRegions: tableStats.uniqueRegions,
    uniqueGarTerritories: tableStats.uniqueGarTerritories,
    uniqueOperators: tableStats.uniqueOperators,
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
  filters: FiltersDTO,
  dataset?: DatasetRef,
  asOf?: string | null
): Promise<SummaryRangesResult> {
  const context = dataset
    ? await resolveRangeQueryContext(dataset, asOf)
    : asOf
      ? await resolveRangeQueryContext({ kind: "current" }, asOf)
      : CURRENT_RANGE_CONTEXT;
  const cached = getCachedSummary<SummaryRangesResult>(filters, dataset, asOf);
  if (cached) {
    return cached;
  }

  const metaRows = await db
    .select()
    .from(datasetMeta)
    .where(eq(datasetMeta.id, 1));
  const metaRow = metaRows[0];
  const uvrBinding = await getUvrAntifraudBindingCached();

  const diffLoadedAt =
    context.isDiff && context.snapshotId
      ? await getSnapshotLoadDate(context.snapshotId)
      : null;
  const fullLoadedAt =
    context.isFull && context.snapshotId
      ? await getSnapshotLoadDate(context.snapshotId)
      : null;
  const loadedAt =
    diffLoadedAt != null
      ? `${diffLoadedAt}T00:00:00.000Z`
      : fullLoadedAt != null
        ? `${fullLoadedAt}T00:00:00.000Z`
        : metaRow?.lastSuccessAt?.toISOString() ?? null;

  const global =
    context.isDiff && context.snapshotId
      ? await loadDiffGlobalFromSnapshot(context.snapshotId)
      : context.isFull && context.snapshotId
        ? await loadFullGlobalFromSnapshot(context.snapshotId)
        : globalSummaryFromMeta(metaRow) ??
          (await loadGlobalSummaryFromTable(context));

  if (!hasActiveFilters(filters)) {
    const result = {
      loadedAt,
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
    setCachedSummary(filters, result, dataset, asOf);
    return result;
  }

  const filteredWhere = buildWhere(filters, context);
  const phoneParts = filters.phoneNumber
    ? parsePhoneNumberMask(filters.phoneNumber)
    : null;
  const table = context.table;

  const filteredResult = await db
    .select({
      rangeCount: count(),
      uniqueRegions: countDistinct(table.region),
      uniqueGarTerritories: countDistinct(table.garTerritory),
      uniqueOperators: countDistinct(table.operator),
    })
    .from(table)
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
          totalCapacity: sum(phoneNumberPartialMatchCountExpr(phoneParts, table)),
        })
        .from(table)
        .where(filteredWhere);
      totalCapacity = Number(capacityResult[0]?.totalCapacity ?? 0);
    }
  } else {
    const capacityResult = await db
      .select({
        totalCapacity: sum(table.capacity),
      })
      .from(table)
      .where(filteredWhere);
    totalCapacity = Number(capacityResult[0]?.totalCapacity ?? 0);
  }

  const result = {
    loadedAt,
    filtered: {
      rangeCount,
      totalCapacity,
      totalCapacityPending,
      uniqueRegions: Number(filtered?.uniqueRegions ?? 0),
      uniqueGarTerritories: Number(filtered?.uniqueGarTerritories ?? 0),
      uniqueOperators: Number(filtered?.uniqueOperators ?? 0),
    },
    global,
    uvrBinding,
  };
  setCachedSummary(filters, result, dataset, asOf);
  return result;
}

export async function listRangesForExport(
  filters: FiltersDTO,
  limit: number,
  cursor?: RangesCursor | null,
  dataset?: DatasetRef,
  asOf?: string | null
) {
  const context = dataset
    ? await resolveRangeQueryContext(dataset, asOf)
    : asOf
      ? await resolveRangeQueryContext({ kind: "current" }, asOf)
      : CURRENT_RANGE_CONTEXT;
  const table = context.table;
  const baseWhere = buildWhere(filters, context);
  const keysetWhere = cursor
    ? buildKeysetWhere(
        table,
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
      id: table.id,
      abc: table.abc,
      rangeStart: table.rangeStart,
      rangeEnd: table.rangeEnd,
      capacity: table.capacity,
      operator: table.operator,
      garTerritory: table.garTerritory,
      region: table.region,
      inn: table.inn,
      uvrAntifraud: operatorsRegister.idSrc,
      abcRangeGapBefore: context.isDiff
        ? sql<boolean>`false`
        : context.isFull
          ? numberRangeFullSnapshots.abcGapBefore
          : numberRanges.abcGapBefore,
      abcRangeGapAfter: context.isDiff
        ? sql<boolean>`false`
        : context.isFull
          ? numberRangeFullSnapshots.abcGapAfter
          : numberRanges.abcGapAfter,
      changeType: context.isDiff ? numberRangeDiffs.changeType : sql<null>`null`,
      prevOperator: context.isDiff ? numberRangeDiffs.prevOperator : sql<null>`null`,
      prevInn: context.isDiff ? numberRangeDiffs.prevInn : sql<null>`null`,
      prevRegion: context.isDiff ? numberRangeDiffs.prevRegion : sql<null>`null`,
      prevGarTerritory: context.isDiff
        ? numberRangeDiffs.prevGarTerritory
        : sql<null>`null`,
    })
    .from(table)
    .leftJoin(operatorsRegister, innRegisterMatchSql(table.inn))
    .where(where)
    .orderBy(asc(table.abc), asc(table.rangeStart), asc(table.id))
    .limit(limit);
}

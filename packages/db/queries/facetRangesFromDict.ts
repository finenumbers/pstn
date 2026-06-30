import type {
  DictFacetColumn,
  FiltersDTO,
} from "@/packages/shared/contracts/filters.schema";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import type { SQL } from "drizzle-orm";
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  ilike,
} from "drizzle-orm";
import { db } from "../index";
import {
  abcDict,
  garTerritoriesDict,
  operatorsDict,
  regionsDict,
} from "../schema";
import { buildWhere, facetColumnForContext } from "./buildWhere";
import {
  resolveQueryContext,
} from "./datasetContext";

type FacetDictValue =
  | typeof abcDict.code
  | typeof operatorsDict.name
  | typeof garTerritoriesDict.name
  | typeof regionsDict.name;

type DictFacetConfig = {
  table:
    | typeof abcDict
    | typeof operatorsDict
    | typeof garTerritoriesDict
    | typeof regionsDict;
  dictValue: FacetDictValue;
};

export const DICT_FACET_CONFIG: Record<
  DictFacetColumn,
  DictFacetConfig
> = {
  abc: {
    table: abcDict,
    dictValue: abcDict.code,
  },
  operator: {
    table: operatorsDict,
    dictValue: operatorsDict.name,
  },
  garTerritory: {
    table: garTerritoriesDict,
    dictValue: garTerritoriesDict.name,
  },
  region: {
    table: regionsDict,
    dictValue: regionsDict.name,
  },
};

export async function facetRangesFromDict(params: {
  column: DictFacetColumn;
  filters: FiltersDTO;
  search?: string;
  limit?: number;
  dataset?: DatasetRef;
  asOf?: string | null;
}) {
  const limit = params.limit ?? 200;
  const context = await resolveQueryContext(params.dataset, params.asOf);

  if (context.isDiff) {
    return facetRangesFromDiffTable({
      column: params.column,
      filters: params.filters,
      search: params.search,
      limit,
      context,
    });
  }

  const config = DICT_FACET_CONFIG[params.column];
  const rangeColumn = facetColumnForContext(params.column, context);
  const rangeWhere = buildWhere(params.filters, context, params.column);

  const searchCondition = params.search
    ? ilike(config.dictValue, `%${params.search}%`)
    : undefined;

  const joinOn = eq(rangeColumn, config.dictValue);
  const filterConditions: SQL[] = [];
  if (rangeWhere) filterConditions.push(rangeWhere);
  if (searchCondition) filterConditions.push(searchCondition);
  const where =
    filterConditions.length > 0 ? and(...filterConditions) : undefined;

  const [options, totalDistinctResult] = await Promise.all([
    db
      .select({
        value: config.dictValue,
        count: count(),
      })
      .from(config.table)
      .innerJoin(context.table, joinOn)
      .where(where)
      .groupBy(config.dictValue)
      .orderBy(desc(count()), asc(config.dictValue))
      .limit(limit),
    db
      .select({ total: countDistinct(config.dictValue) })
      .from(config.table)
      .innerJoin(context.table, joinOn)
      .where(where),
  ]);

  return {
    options: options.map((o) => ({
      value: String(o.value),
      count: Number(o.count),
    })),
    totalDistinct: Number(totalDistinctResult[0]?.total ?? 0),
  };
}

async function facetRangesFromDiffTable(params: {
  column: DictFacetColumn;
  filters: FiltersDTO;
  search?: string;
  limit?: number;
  context: Awaited<ReturnType<typeof resolveQueryContext>>;
}) {
  const rangeColumn = facetColumnForContext(params.column, params.context);
  const rangeWhere = buildWhere(params.filters, params.context, params.column);
  const conditions: SQL[] = [];
  if (params.search) {
    conditions.push(ilike(rangeColumn, `%${params.search}%`));
  }
  if (rangeWhere) {
    conditions.push(rangeWhere);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [options, totalDistinctResult] = await Promise.all([
    db
      .select({
        value: rangeColumn,
        count: count(),
      })
      .from(params.context.table)
      .where(where)
      .groupBy(rangeColumn)
      .orderBy(desc(count()), asc(rangeColumn))
      .limit(params.limit ?? 200),
    db
      .select({ total: countDistinct(rangeColumn) })
      .from(params.context.table)
      .where(where),
  ]);

  return {
    options: options.map((o) => ({
      value: String(o.value),
      count: Number(o.count),
    })),
    totalDistinct: Number(totalDistinctResult[0]?.total ?? 0),
  };
}

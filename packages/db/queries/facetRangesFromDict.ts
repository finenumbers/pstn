import type { FiltersDTO, FacetColumn } from "@/packages/shared/contracts/filters.schema";
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
  numberRanges,
  operatorsDict,
  regionsDict,
  settlementsDict,
} from "../schema";
import { buildWhere } from "./buildWhere";

type FacetDictValue =
  | typeof abcDict.code
  | typeof operatorsDict.name
  | typeof settlementsDict.name
  | typeof regionsDict.name;

type FacetRangeColumn =
  | typeof numberRanges.abc
  | typeof numberRanges.operator
  | typeof numberRanges.settlement
  | typeof numberRanges.region;

type DictFacetConfig = {
  table:
    | typeof abcDict
    | typeof operatorsDict
    | typeof settlementsDict
    | typeof regionsDict;
  dictValue: FacetDictValue;
  rangeColumn: FacetRangeColumn;
};

export const DICT_FACET_CONFIG: Record<FacetColumn, DictFacetConfig> = {
  abc: {
    table: abcDict,
    dictValue: abcDict.code,
    rangeColumn: numberRanges.abc,
  },
  operator: {
    table: operatorsDict,
    dictValue: operatorsDict.name,
    rangeColumn: numberRanges.operator,
  },
  settlement: {
    table: settlementsDict,
    dictValue: settlementsDict.name,
    rangeColumn: numberRanges.settlement,
  },
  region: {
    table: regionsDict,
    dictValue: regionsDict.name,
    rangeColumn: numberRanges.region,
  },
};

export async function facetRangesFromDict(params: {
  column: FacetColumn;
  filters: FiltersDTO;
  search?: string;
  limit?: number;
}) {
  const limit = params.limit ?? 200;
  const config = DICT_FACET_CONFIG[params.column];
  const rangeWhere = buildWhere(params.filters, params.column);

  const joinOn = rangeWhere
    ? and(eq(config.rangeColumn, config.dictValue), rangeWhere)
    : eq(config.rangeColumn, config.dictValue);

  const dictConditions: SQL[] = [];
  if (params.search) {
    dictConditions.push(ilike(config.dictValue, `%${params.search}%`));
  }
  const dictWhere =
    dictConditions.length > 0 ? and(...dictConditions) : undefined;

  const [options, totalDistinctResult] = await Promise.all([
    db
      .select({
        value: config.dictValue,
        count: count(numberRanges.id),
      })
      .from(config.table)
      .innerJoin(numberRanges, joinOn)
      .where(dictWhere)
      .groupBy(config.dictValue)
      .orderBy(desc(count(numberRanges.id)), asc(config.dictValue))
      .limit(limit),
    db
      .select({ total: countDistinct(config.dictValue) })
      .from(config.table)
      .innerJoin(numberRanges, joinOn)
      .where(dictWhere),
  ]);

  return {
    options: options.map((o) => ({
      value: String(o.value),
      count: Number(o.count),
    })),
    totalDistinct: Number(totalDistinctResult[0]?.total ?? 0),
  };
}

import type { FiltersDTO } from "@/packages/shared/contracts/filters.schema";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import { and, asc, count, countDistinct, desc, ilike, type SQL } from "drizzle-orm";
import { db } from "../index";
import { buildWhere } from "./buildWhere";
import {
  CURRENT_RANGE_CONTEXT,
  resolveRangeQueryContext,
} from "./datasetContext";

export async function facetInnRanges(params: {
  filters: FiltersDTO;
  search?: string;
  limit?: number;
  dataset?: DatasetRef;
}) {
  const limit = params.limit ?? 200;
  const context = params.dataset
    ? await resolveRangeQueryContext(params.dataset)
    : CURRENT_RANGE_CONTEXT;
  const table = context.table;
  const rangeWhere = buildWhere(params.filters, context, "inn");
  const conditions: SQL[] = [];
  if (params.search) {
    conditions.push(ilike(table.inn, `%${params.search}%`));
  }
  if (rangeWhere) {
    conditions.push(rangeWhere);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [options, totalDistinctResult] = await Promise.all([
    db
      .select({
        value: table.inn,
        count: count(),
      })
      .from(table)
      .where(where)
      .groupBy(table.inn)
      .orderBy(desc(count()), asc(table.inn))
      .limit(limit),
    db
      .select({ total: countDistinct(table.inn) })
      .from(table)
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

import type { FiltersDTO } from "@/packages/shared/contracts/filters.schema";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import { and, asc, count, countDistinct, desc, ilike, sql, type SQL } from "drizzle-orm";
import { db } from "../index";
import { operatorsRegister } from "../schema";
import { buildWhere } from "./buildWhere";
import { resolveQueryContext } from "./datasetContext";
import { innRegisterMatchSql } from "./innRegisterMatch";

export async function facetUvrAntifraudRanges(params: {
  filters: FiltersDTO;
  search?: string;
  limit?: number;
  dataset?: DatasetRef;
  asOf?: string | null;
}) {
  const limit = params.limit ?? 200;
  const context = await resolveQueryContext(params.dataset, params.asOf);
  const table = context.table;
  const rangeWhere = buildWhere(params.filters, context, "uvrAntifraud");
  const conditions: SQL[] = [];
  if (params.search) {
    conditions.push(
      ilike(sql`${operatorsRegister.idSrc}::text`, `%${params.search}%`)
    );
  }
  if (rangeWhere) {
    conditions.push(rangeWhere);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [options, totalDistinctResult] = await Promise.all([
    db
      .select({
        value: sql<string>`${operatorsRegister.idSrc}::text`.as("value"),
        count: count(table.id),
      })
      .from(table)
      .innerJoin(operatorsRegister, innRegisterMatchSql(table.inn))
      .where(where)
      .groupBy(operatorsRegister.idSrc)
      .orderBy(desc(count(table.id)), asc(operatorsRegister.idSrc))
      .limit(limit),
    db
      .select({
        total: countDistinct(operatorsRegister.idSrc),
      })
      .from(table)
      .innerJoin(operatorsRegister, innRegisterMatchSql(table.inn))
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

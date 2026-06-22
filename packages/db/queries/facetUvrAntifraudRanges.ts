import type { FiltersDTO } from "@/packages/shared/contracts/filters.schema";
import { and, asc, count, countDistinct, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db } from "../index";
import { numberRanges, operatorsRegister } from "../schema";
import { buildWhere } from "./buildWhere";

export async function facetUvrAntifraudRanges(params: {
  filters: FiltersDTO;
  search?: string;
  limit?: number;
}) {
  const limit = params.limit ?? 200;
  const rangeWhere = buildWhere(params.filters, "uvrAntifraud");
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
        count: count(numberRanges.id),
      })
      .from(numberRanges)
      .innerJoin(
        operatorsRegister,
        eq(numberRanges.inn, operatorsRegister.inn)
      )
      .where(where)
      .groupBy(operatorsRegister.idSrc)
      .orderBy(desc(count(numberRanges.id)), asc(operatorsRegister.idSrc))
      .limit(limit),
    db
      .select({
        total: countDistinct(operatorsRegister.idSrc),
      })
      .from(numberRanges)
      .innerJoin(
        operatorsRegister,
        eq(numberRanges.inn, operatorsRegister.inn)
      )
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

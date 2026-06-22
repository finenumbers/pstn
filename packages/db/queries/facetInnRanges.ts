import type { FiltersDTO } from "@/packages/shared/contracts/filters.schema";
import { and, asc, count, countDistinct, desc, ilike, type SQL } from "drizzle-orm";
import { db } from "../index";
import { numberRanges } from "../schema";
import { buildWhere } from "./buildWhere";

export async function facetInnRanges(params: {
  filters: FiltersDTO;
  search?: string;
  limit?: number;
}) {
  const limit = params.limit ?? 200;
  const rangeWhere = buildWhere(params.filters, "inn");
  const conditions: SQL[] = [];
  if (params.search) {
    conditions.push(ilike(numberRanges.inn, `%${params.search}%`));
  }
  if (rangeWhere) {
    conditions.push(rangeWhere);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [options, totalDistinctResult] = await Promise.all([
    db
      .select({
        value: numberRanges.inn,
        count: count(),
      })
      .from(numberRanges)
      .where(where)
      .groupBy(numberRanges.inn)
      .orderBy(desc(count()), asc(numberRanges.inn))
      .limit(limit),
    db
      .select({ total: countDistinct(numberRanges.inn) })
      .from(numberRanges)
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

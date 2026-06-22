import type { FiltersDTO, FacetColumn } from "@/packages/shared/contracts/filters.schema";
import { and, count, eq } from "drizzle-orm";
import { db } from "../index";
import { numberRanges } from "../schema";
import { buildWhere, FACET_COLUMN_MAP } from "./buildWhere";

/** Count rows matching all filters including a specific facet value. */
export async function countFacetValue(
  column: FacetColumn,
  value: string,
  filters: FiltersDTO
): Promise<number> {
  const columnField = FACET_COLUMN_MAP[column];
  const baseWhere = buildWhere(filters);
  const valueWhere = eq(columnField, value);
  const where = baseWhere ? and(baseWhere, valueWhere) : valueWhere;

  const result = await db
    .select({ total: count() })
    .from(numberRanges)
    .where(where);

  return Number(result[0]?.total ?? 0);
}

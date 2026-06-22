import type { FiltersDTO, FacetColumn } from "@/packages/shared/contracts/filters.schema";
import { and, count, eq, sql, type SQL } from "drizzle-orm";
import { db } from "../index";
import { numberRanges, operatorsRegister } from "../schema";
import { buildWhere, FACET_COLUMN_MAP } from "./buildWhere";
import { innRegisterMatchSql } from "./innRegisterMatch";

function uvrAntifraudValueWhere(value: string): SQL {
  return sql`EXISTS (
    SELECT 1
    FROM ${operatorsRegister}
    WHERE ${innRegisterMatchSql()}
      AND ${operatorsRegister.idSrc}::text = ${value}
  )`;
}

/** Count rows matching all filters including a specific facet value. */
export async function countFacetValue(
  column: FacetColumn,
  value: string,
  filters: FiltersDTO
): Promise<number> {
  const baseWhere = buildWhere(filters);
  const valueWhere =
    column === "uvrAntifraud"
      ? uvrAntifraudValueWhere(value)
      : eq(FACET_COLUMN_MAP[column], value);
  const where = baseWhere ? and(baseWhere, valueWhere) : valueWhere;

  const result = await db
    .select({ total: count() })
    .from(numberRanges)
    .where(where);

  return Number(result[0]?.total ?? 0);
}

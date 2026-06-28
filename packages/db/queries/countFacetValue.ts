import type { FiltersDTO, FacetColumn } from "@/packages/shared/contracts/filters.schema";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import { and, count, eq, sql, type SQL } from "drizzle-orm";
import { db } from "../index";
import { operatorsRegister } from "../schema";
import { buildWhere, facetColumnForContext } from "./buildWhere";
import {
  CURRENT_RANGE_CONTEXT,
  resolveRangeQueryContext,
} from "./datasetContext";
import { innRegisterMatchSql } from "./innRegisterMatch";

function uvrAntifraudValueWhere(
  table: (typeof CURRENT_RANGE_CONTEXT)["table"],
  value: string
): SQL {
  return sql`EXISTS (
    SELECT 1
    FROM ${operatorsRegister}
    WHERE ${innRegisterMatchSql(table.inn)}
      AND ${operatorsRegister.idSrc}::text = ${value}
  )`;
}

/** Count rows matching all filters including a specific facet value. */
export async function countFacetValue(
  column: FacetColumn,
  value: string,
  filters: FiltersDTO,
  dataset?: DatasetRef
): Promise<number> {
  const context = dataset
    ? await resolveRangeQueryContext(dataset)
    : CURRENT_RANGE_CONTEXT;
  const table = context.table;
  const baseWhere = buildWhere(filters, context);
  const valueWhere =
    column === "uvrAntifraud"
      ? uvrAntifraudValueWhere(table, value)
      : eq(facetColumnForContext(column, context), value);
  const where = baseWhere ? and(baseWhere, valueWhere) : valueWhere;

  const result = await db
    .select({ total: count() })
    .from(table)
    .where(where);

  return Number(result[0]?.total ?? 0);
}

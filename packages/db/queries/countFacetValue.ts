import type { FiltersDTO, FacetColumn } from "@/packages/shared/contracts/filters.schema";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import { and, count, eq, sql, type SQL } from "drizzle-orm";
import { db } from "../index";
import { operatorsRegister } from "../schema";
import { buildWhere, facetColumnForContext } from "./buildWhere";
import { sqlForChangedFieldKey } from "./changedFieldsFilter";
import { sqlForChangeStatusKey } from "./changeStatusFilter";
import { resolveQueryContext } from "./datasetContext";
import { innRegisterMatchSql } from "./innRegisterMatch";

import type { RangeFilterTable } from "./rangeFilterTable";

function uvrAntifraudValueWhere(
  table: RangeFilterTable,
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
  dataset?: DatasetRef,
  asOf?: string | null
): Promise<number> {
  const context = await resolveQueryContext(dataset, asOf);
  const table = context.table;
  const baseWhere = buildWhere(filters, context);
  const valueWhere =
    column === "uvrAntifraud"
      ? uvrAntifraudValueWhere(table, value)
      : column === "changeStatus"
        ? sqlForChangeStatusKey(
            value as Parameters<typeof sqlForChangeStatusKey>[0]
          )
      : column === "changedFields"
        ? sqlForChangedFieldKey(value as Parameters<typeof sqlForChangedFieldKey>[0])
        : eq(facetColumnForContext(column, context), value);
  const where = baseWhere ? and(baseWhere, valueWhere) : valueWhere;

  const result = await db
    .select({ total: count() })
    .from(table)
    .where(where);

  return Number(result[0]?.total ?? 0);
}

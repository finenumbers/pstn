import { and, sql, type SQL } from "drizzle-orm";
import type {
  RangesCursor,
  SortableColumn,
} from "@/packages/shared/contracts/filters.schema";
import type { RangeFilterTable } from "./rangeFilterTable";

function getColumnMap(table: RangeFilterTable) {
  return {
    abc: table.abc,
    rangeStart: table.rangeStart,
    rangeEnd: table.rangeEnd,
    capacity: table.capacity,
    operator: table.operator,
    garTerritory: table.garTerritory,
    region: table.region,
    inn: table.inn,
  } as const;
}

/**
 * Tuple keyset for uniform sort direction (all ASC or all DESC).
 * Returns undefined for mixed directions — caller falls back to OFFSET.
 */
export function buildKeysetWhere(
  table: RangeFilterTable,
  sort: { id: SortableColumn; desc: boolean }[],
  cursor: RangesCursor
): SQL | undefined {
  if (!cursor.id || sort.length === 0) return undefined;

  const allAsc = sort.every((s) => !s.desc);
  const allDesc = sort.every((s) => s.desc);
  if (!allAsc && !allDesc) return undefined;

  const columnMap = getColumnMap(table);
  const op = allAsc ? ">" : "<";
  const columnSql = sort.map((s) => columnMap[s.id]);
  const valueSql = sort.map((s) => sql`${cursor[s.id]}`);

  return sql`(${sql.join(columnSql, sql`, `)}, ${table.id}) ${sql.raw(op)} (${sql.join(valueSql, sql`, `)}, ${cursor.id})`;
}

export function mergeKeysetWhere(
  baseWhere: SQL | undefined,
  keysetWhere: SQL | undefined
): SQL | undefined {
  if (!keysetWhere) return baseWhere;
  if (!baseWhere) return keysetWhere;
  return and(baseWhere, keysetWhere);
}

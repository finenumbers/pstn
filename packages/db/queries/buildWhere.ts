import type { FiltersDTO, FacetColumn } from "@/packages/shared/contracts/filters.schema";
import { expandAbcMask, parsePhoneNumberMask } from "@/lib/phoneNumberMask";
import {
  and,
  eq,
  inArray,
  sql,
  type SQL,
  type AnyColumn,
} from "drizzle-orm";
import { operatorsRegister } from "../schema";
import { sqlForChangedFieldKeys } from "./changedFieldsFilter";
import {
  CURRENT_RANGE_CONTEXT,
  mergeSnapshotFilter,
  type RangeQueryContext,
} from "./datasetContext";
import { innRegisterMatchSql } from "./innRegisterMatch";
import { phoneNumberOverlapSql } from "./phoneNumberMatchCount";
import type { RangeFilterTable } from "./rangeFilterTable";

export const COVERAGE_AND_COLUMNS = [
  "abc",
  "region",
  "garTerritory",
  "operator",
] as const;

export type CoverageAndColumn = (typeof COVERAGE_AND_COLUMNS)[number];

function getColumnMap(table: RangeFilterTable) {
  return {
    abc: table.abc,
    region: table.region,
    garTerritory: table.garTerritory,
    operator: table.operator,
    rangeStart: table.rangeStart,
    rangeEnd: table.rangeEnd,
    capacity: table.capacity,
    inn: table.inn,
  } as const;
}

function textNumericFilter(column: AnyColumn, value: string): SQL | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) {
    const num = Number(value);
    return sql`${column}::text LIKE ${value + "%"} OR ${column} = ${num}`;
  }
  return sql`${column}::text ILIKE ${"%" + value + "%"}`;
}

function capacityFilter(
  table: RangeFilterTable,
  value: string
): SQL | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) {
    return eq(table.capacity, Number(value));
  }
  return sql`${table.capacity}::text ILIKE ${"%" + value + "%"}`;
}

function abcMaskFilter(
  table: RangeFilterTable,
  parsed: ReturnType<typeof parsePhoneNumberMask>
): SQL | undefined {
  if (!parsed) return undefined;

  const expanded = expandAbcMask(parsed.abcSlots);
  if (expanded) {
    if (expanded.length === 1) {
      return eq(table.abc, expanded[0]!);
    }
    return inArray(table.abc, expanded);
  }

  const substringConditions: SQL[] = [];
  for (let index = 0; index < 3; index++) {
    const slot = parsed.abcSlots[index];
    if (slot !== "_") {
      substringConditions.push(
        sql`substring(${table.abc}, ${index + 1}, 1) = ${slot}`
      );
    }
  }

  return substringConditions.length > 0 ? and(...substringConditions) : undefined;
}

function phoneNumberFilter(
  table: RangeFilterTable,
  value: string
): SQL | undefined {
  const parsed = parsePhoneNumberMask(value);
  if (!parsed) return undefined;

  const conditions: SQL[] = [phoneNumberOverlapSql(parsed, table)];

  const abcCondition = abcMaskFilter(table, parsed);
  if (abcCondition) {
    conditions.push(abcCondition);
  }

  return and(...conditions);
}

function uvrAntifraudFilter(
  table: RangeFilterTable,
  values: string[]
): SQL | undefined {
  if (values.length === 0) return undefined;
  return sql`EXISTS (
    SELECT 1
    FROM ${operatorsRegister}
    WHERE ${innRegisterMatchSql(table.inn)}
      AND ${operatorsRegister.idSrc}::text IN (${sql.join(
        values.map((value) => sql`${value}`),
        sql`, `
      )})
  )`;
}

function buildCoverageOperatorInSql(
  context: RangeQueryContext,
  column: CoverageAndColumn,
  values: string[],
  filters: FiltersDTO,
  excludeColumn?: string
): SQL | undefined {
  if (values.length <= 1) return undefined;

  const table = context.table;
  const columns = getColumnMap(table);
  const partialFilters: FiltersDTO = { ...filters, [column]: [] };
  const partialWhere = buildWhere(partialFilters, context, excludeColumn);

  const columnRef = columns[column];
  const rowConstraint = inArray(columnRef, values);
  const whereClause = partialWhere
    ? and(partialWhere, rowConstraint)
    : rowConstraint;

  return sql`${table.operator} IN (
    SELECT ${table.operator}
    FROM ${table}
    WHERE ${whereClause}
    GROUP BY ${table.operator}
    HAVING COUNT(DISTINCT ${columnRef}) = ${values.length}
  )`;
}

function buildCoverageColumnCondition(
  context: RangeQueryContext,
  column: CoverageAndColumn,
  values: string[],
  filters: FiltersDTO,
  excludeColumn?: string
): SQL | undefined {
  if (values.length === 0) return undefined;

  const table = context.table;
  const columns = getColumnMap(table);

  if (excludeColumn === column) {
    return buildCoverageOperatorInSql(
      context,
      column,
      values,
      filters,
      excludeColumn
    );
  }

  if (values.length === 1) {
    return eq(columns[column], values[0]);
  }

  const operatorConstraint = buildCoverageOperatorInSql(
    context,
    column,
    values,
    filters,
    excludeColumn
  );
  const rowConstraint = inArray(columns[column], values);

  return operatorConstraint
    ? and(rowConstraint, operatorConstraint)
    : rowConstraint;
}

export function collectWhereConditions(
  filters: FiltersDTO,
  context: RangeQueryContext = CURRENT_RANGE_CONTEXT,
  excludeColumn?: string
): SQL[] {
  const table = context.table;
  const columns = getColumnMap(table);
  const conditions: SQL[] = [];

  for (const column of COVERAGE_AND_COLUMNS) {
    const values = filters[column];
    if (values.length === 0) continue;
    const cond = buildCoverageColumnCondition(
      context,
      column,
      values,
      filters,
      excludeColumn
    );
    if (cond) conditions.push(cond);
  }

  if (excludeColumn !== "inn" && filters.inn.length > 0) {
    conditions.push(inArray(columns.inn, filters.inn));
  }
  if (excludeColumn !== "uvrAntifraud" && filters.uvrAntifraud.length > 0) {
    const cond = uvrAntifraudFilter(table, filters.uvrAntifraud);
    if (cond) conditions.push(cond);
  }
  if (excludeColumn !== "rangeStart" && filters.rangeStart) {
    const cond = textNumericFilter(columns.rangeStart, filters.rangeStart);
    if (cond) conditions.push(cond);
  }
  if (excludeColumn !== "rangeEnd" && filters.rangeEnd) {
    const cond = textNumericFilter(columns.rangeEnd, filters.rangeEnd);
    if (cond) conditions.push(cond);
  }
  if (excludeColumn !== "capacity" && filters.capacity) {
    const cond = capacityFilter(table, filters.capacity);
    if (cond) conditions.push(cond);
  }
  if (filters.phoneNumber) {
    const cond = phoneNumberFilter(table, filters.phoneNumber);
    if (cond) conditions.push(cond);
  }

  if (
    context.isDiff &&
    excludeColumn !== "changedFields" &&
    filters.changedFields.length > 0
  ) {
    const cond = sqlForChangedFieldKeys(filters.changedFields);
    if (cond) conditions.push(cond);
  }

  return conditions;
}

export function buildWhere(
  filters: FiltersDTO,
  contextOrExclude?: RangeQueryContext | string,
  excludeColumn?: string
): SQL | undefined {
  let context = CURRENT_RANGE_CONTEXT;
  let exclude = excludeColumn;

  if (typeof contextOrExclude === "string") {
    exclude = contextOrExclude;
  } else if (contextOrExclude) {
    context = contextOrExclude;
  }

  const conditions = collectWhereConditions(filters, context, exclude);
  if (conditions.length === 0) {
    return mergeSnapshotFilter(context, undefined);
  }
  return mergeSnapshotFilter(context, and(...conditions));
}

export function facetColumnForContext(
  column: Exclude<FacetColumn, "uvrAntifraud" | "changedFields">,
  context: RangeQueryContext
) {
  const columns = getColumnMap(context.table);
  return columns[column];
}

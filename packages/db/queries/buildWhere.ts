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
import { numberRanges, operatorsRegister } from "../schema";
import { innRegisterMatchSql } from "./innRegisterMatch";
import { phoneNumberOverlapSql } from "./phoneNumberMatchCount";

export const COVERAGE_AND_COLUMNS = [
  "abc",
  "region",
  "garTerritory",
  "operator",
] as const;

export type CoverageAndColumn = (typeof COVERAGE_AND_COLUMNS)[number];

const COVERAGE_COLUMN_MAP = {
  abc: numberRanges.abc,
  region: numberRanges.region,
  garTerritory: numberRanges.garTerritory,
  operator: numberRanges.operator,
} as const;

function textNumericFilter(column: AnyColumn, value: string): SQL | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) {
    const num = Number(value);
    return sql`${column}::text LIKE ${value + "%"} OR ${column} = ${num}`;
  }
  return sql`${column}::text ILIKE ${"%" + value + "%"}`;
}

function capacityFilter(value: string): SQL | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) {
    return eq(numberRanges.capacity, Number(value));
  }
  return sql`${numberRanges.capacity}::text ILIKE ${"%" + value + "%"}`;
}

function abcMaskFilter(parsed: ReturnType<typeof parsePhoneNumberMask>): SQL | undefined {
  if (!parsed) return undefined;

  const expanded = expandAbcMask(parsed.abcSlots);
  if (expanded) {
    if (expanded.length === 1) {
      return eq(numberRanges.abc, expanded[0]!);
    }
    return inArray(numberRanges.abc, expanded);
  }

  const substringConditions: SQL[] = [];
  for (let index = 0; index < 3; index++) {
    const slot = parsed.abcSlots[index];
    if (slot !== "_") {
      substringConditions.push(
        sql`substring(${numberRanges.abc}, ${index + 1}, 1) = ${slot}`
      );
    }
  }

  return substringConditions.length > 0 ? and(...substringConditions) : undefined;
}

function phoneNumberFilter(value: string): SQL | undefined {
  const parsed = parsePhoneNumberMask(value);
  if (!parsed) return undefined;

  const conditions: SQL[] = [phoneNumberOverlapSql(parsed)];

  const abcCondition = abcMaskFilter(parsed);
  if (abcCondition) {
    conditions.push(abcCondition);
  }

  return and(...conditions);
}

function uvrAntifraudFilter(values: string[]): SQL | undefined {
  if (values.length === 0) return undefined;
  return sql`EXISTS (
    SELECT 1
    FROM ${operatorsRegister}
    WHERE ${innRegisterMatchSql()}
      AND ${operatorsRegister.idSrc}::text IN (${sql.join(
        values.map((value) => sql`${value}`),
        sql`, `
      )})
  )`;
}

function buildCoverageOperatorInSql(
  column: CoverageAndColumn,
  values: string[],
  filters: FiltersDTO,
  excludeColumn?: string
): SQL | undefined {
  if (values.length <= 1) return undefined;

  const partialFilters: FiltersDTO = { ...filters, [column]: [] };
  const partialConditions = collectWhereConditions(
    partialFilters,
    excludeColumn
  );

  const columnRef = COVERAGE_COLUMN_MAP[column];
  const rowConstraint = inArray(columnRef, values);
  const whereClause =
    partialConditions.length > 0
      ? and(...partialConditions, rowConstraint)
      : rowConstraint;

  return sql`${numberRanges.operator} IN (
    SELECT ${numberRanges.operator}
    FROM ${numberRanges}
    WHERE ${whereClause}
    GROUP BY ${numberRanges.operator}
    HAVING COUNT(DISTINCT ${columnRef}) = ${values.length}
  )`;
}

function buildCoverageColumnCondition(
  column: CoverageAndColumn,
  values: string[],
  filters: FiltersDTO,
  excludeColumn?: string
): SQL | undefined {
  if (values.length === 0) return undefined;

  if (excludeColumn === column) {
    return buildCoverageOperatorInSql(column, values, filters, excludeColumn);
  }

  if (values.length === 1) {
    return eq(COVERAGE_COLUMN_MAP[column], values[0]);
  }

  const operatorConstraint = buildCoverageOperatorInSql(
    column,
    values,
    filters,
    excludeColumn
  );
  const rowConstraint = inArray(COVERAGE_COLUMN_MAP[column], values);

  return operatorConstraint
    ? and(rowConstraint, operatorConstraint)
    : rowConstraint;
}

export function collectWhereConditions(
  filters: FiltersDTO,
  excludeColumn?: string
): SQL[] {
  const conditions: SQL[] = [];

  for (const column of COVERAGE_AND_COLUMNS) {
    const values = filters[column];
    if (values.length === 0) continue;
    const cond = buildCoverageColumnCondition(
      column,
      values,
      filters,
      excludeColumn
    );
    if (cond) conditions.push(cond);
  }

  if (excludeColumn !== "inn" && filters.inn.length > 0) {
    conditions.push(inArray(numberRanges.inn, filters.inn));
  }
  if (excludeColumn !== "uvrAntifraud" && filters.uvrAntifraud.length > 0) {
    const cond = uvrAntifraudFilter(filters.uvrAntifraud);
    if (cond) conditions.push(cond);
  }
  if (excludeColumn !== "rangeStart" && filters.rangeStart) {
    const cond = textNumericFilter(numberRanges.rangeStart, filters.rangeStart);
    if (cond) conditions.push(cond);
  }
  if (excludeColumn !== "rangeEnd" && filters.rangeEnd) {
    const cond = textNumericFilter(numberRanges.rangeEnd, filters.rangeEnd);
    if (cond) conditions.push(cond);
  }
  if (excludeColumn !== "capacity" && filters.capacity) {
    const cond = capacityFilter(filters.capacity);
    if (cond) conditions.push(cond);
  }
  if (filters.phoneNumber) {
    const cond = phoneNumberFilter(filters.phoneNumber);
    if (cond) conditions.push(cond);
  }

  return conditions;
}

export function buildWhere(
  filters: FiltersDTO,
  excludeColumn?: string
): SQL | undefined {
  const conditions = collectWhereConditions(filters, excludeColumn);
  if (conditions.length === 0) return undefined;
  return and(...conditions);
}

export const FACET_COLUMN_MAP: Record<
  Exclude<FacetColumn, "uvrAntifraud">,
  | typeof numberRanges.abc
  | typeof numberRanges.operator
  | typeof numberRanges.garTerritory
  | typeof numberRanges.region
  | typeof numberRanges.inn
> = {
  abc: numberRanges.abc,
  operator: numberRanges.operator,
  garTerritory: numberRanges.garTerritory,
  region: numberRanges.region,
  inn: numberRanges.inn,
};

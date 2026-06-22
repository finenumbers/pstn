import type { FiltersDTO, FacetColumn } from "@/packages/shared/contracts/filters.schema";
import { parsePhoneNumberMask } from "@/lib/phoneNumberMask";
import {
  and,
  eq,
  ilike,
  inArray,
  sql,
  type SQL,
  type AnyColumn,
} from "drizzle-orm";
import { numberRanges } from "../schema";
import { phoneNumberOverlapSql } from "./phoneNumberMatchCount";

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

function phoneNumberFilter(value: string): SQL | undefined {
  const parsed = parsePhoneNumberMask(value);
  if (!parsed) return undefined;

  const conditions: SQL[] = [
    sql`${numberRanges.rangeStart} <= ${numberRanges.rangeEnd}`,
    phoneNumberOverlapSql(parsed),
  ];

  for (let index = 0; index < 3; index++) {
    const slot = parsed.abcSlots[index];
    if (slot !== "_") {
      conditions.push(
        sql`substring(${numberRanges.abc}, ${index + 1}, 1) = ${slot}`
      );
    }
  }

  return and(...conditions);
}

export function buildWhere(
  filters: FiltersDTO,
  excludeColumn?: string
): SQL | undefined {
  const conditions: SQL[] = [];

  if (excludeColumn !== "abc" && filters.abc.length > 0) {
    conditions.push(inArray(numberRanges.abc, filters.abc));
  }
  if (excludeColumn !== "operator" && filters.operator.length > 0) {
    conditions.push(inArray(numberRanges.operator, filters.operator));
  }
  if (excludeColumn !== "settlement" && filters.settlement.length > 0) {
    conditions.push(inArray(numberRanges.settlement, filters.settlement));
  }
  if (excludeColumn !== "region" && filters.region.length > 0) {
    conditions.push(inArray(numberRanges.region, filters.region));
  }
  if (excludeColumn !== "inn" && filters.inn) {
    conditions.push(ilike(numberRanges.inn, `%${filters.inn}%`));
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

  if (conditions.length === 0) return undefined;
  return and(...conditions);
}

export const FACET_COLUMN_MAP: Record<
  FacetColumn,
  | typeof numberRanges.abc
  | typeof numberRanges.operator
  | typeof numberRanges.settlement
  | typeof numberRanges.region
> = {
  abc: numberRanges.abc,
  operator: numberRanges.operator,
  settlement: numberRanges.settlement,
  region: numberRanges.region,
};

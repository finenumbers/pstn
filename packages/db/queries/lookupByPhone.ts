import { DEFAULT_FILTERS } from "@/packages/shared/contracts/filters.schema";
import { parsePhoneNumberMask } from "@/lib/phoneNumberMask";
import { asc } from "drizzle-orm";
import { db } from "../index";
import { numberRanges, operatorsRegister } from "../schema";
import { buildWhere } from "./buildWhere";
import { innRegisterMatchSql } from "./innRegisterMatch";

export type LookupByPhoneResult =
  | { status: "found"; row: LookupRangeRow }
  | { status: "not_found" }
  | { status: "ambiguous"; matchCount: number };

export type LookupRangeRow = {
  id: number;
  abc: string;
  rangeStart: number;
  rangeEnd: number;
  capacity: number;
  operator: string;
  garTerritory: string;
  region: string;
  inn: string;
  uvrAntifraud: number | null;
  abcRangeGapBefore: boolean;
  abcRangeGapAfter: boolean;
};

export async function lookupByPhone(phone: string): Promise<LookupByPhoneResult> {
  const parts = parsePhoneNumberMask(phone);
  if (!parts) {
    return { status: "not_found" };
  }

  const where = buildWhere({
    ...DEFAULT_FILTERS,
    phoneNumber: phone,
  });

  const rows = await db
    .select({
      id: numberRanges.id,
      abc: numberRanges.abc,
      rangeStart: numberRanges.rangeStart,
      rangeEnd: numberRanges.rangeEnd,
      capacity: numberRanges.capacity,
      operator: numberRanges.operator,
      garTerritory: numberRanges.garTerritory,
      region: numberRanges.region,
      inn: numberRanges.inn,
      uvrAntifraud: operatorsRegister.idSrc,
      abcRangeGapBefore: numberRanges.abcGapBefore,
      abcRangeGapAfter: numberRanges.abcGapAfter,
    })
    .from(numberRanges)
    .leftJoin(operatorsRegister, innRegisterMatchSql())
    .where(where)
    .orderBy(asc(numberRanges.id))
    .limit(2);

  if (rows.length === 0) {
    return { status: "not_found" };
  }

  if (rows.length > 1) {
    return { status: "ambiguous", matchCount: rows.length };
  }

  return { status: "found", row: rows[0]! };
}

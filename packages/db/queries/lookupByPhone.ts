import { DEFAULT_FILTERS } from "@/packages/shared/contracts/filters.schema";
import { parsePhoneNumberMask } from "@/lib/phoneNumberMask";
import { asc } from "drizzle-orm";
import { db } from "../index";
import { numberRanges, operatorsRegister } from "../schema";
import { buildWhere } from "./buildWhere";
import { innRegisterMatchSql } from "./innRegisterMatch";

export async function lookupByPhone(phone: string) {
  const parts = parsePhoneNumberMask(phone);
  if (!parts) {
    return null;
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
      settlement: numberRanges.settlement,
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
    return null;
  }

  if (rows.length > 1) {
    console.warn(
      `lookupByPhone: multiple ranges matched phone ${phone}, returning first by id`
    );
  }

  return rows[0];
}

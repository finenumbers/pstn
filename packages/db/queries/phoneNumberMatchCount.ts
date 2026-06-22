import type { PhoneNumberMaskParts } from "@/lib/phoneNumberMask";
import { EMPTY_PHONE_SLOT, serializePhoneMask } from "@/lib/phoneNumberMask";
import { and, sql, type SQL } from "drizzle-orm";
import { numberRanges } from "../schema";

const RANGE_START = '"number_ranges"."range_start"';
const RANGE_END = '"number_ranges"."range_end"';

export function isAllSubscriberDigitsFixed(parts: PhoneNumberMaskParts): boolean {
  return parts.subscriberSlots.every((slot) => slot !== EMPTY_PHONE_SLOT);
}

/** Strict overlap: range must contain at least one subscriber number matching all fixed mask digits. */
export function phoneNumberOverlapSql(parts: PhoneNumberMaskParts): SQL {
  if (isAllSubscriberDigitsFixed(parts)) {
    const number = parts.subscriberMin;
    return sql.raw(
      `${RANGE_START} <= ${number} AND ${RANGE_END} >= ${number}`
    );
  }

  const mask = serializePhoneMask(parts.slots);
  return and(
    sql`${numberRanges.rangeStart} <= ${parts.subscriberMax}`,
    sql`${numberRanges.rangeEnd} >= ${parts.subscriberMin}`,
    sql`phone_mask_match_count(${numberRanges.rangeStart}, ${numberRanges.rangeEnd}, ${mask}) > 0`
  )!;
}

/** Per-row match count for any subscriber mask (full or partial wildcards). */
export function phoneNumberPartialMatchCountExpr(parts: PhoneNumberMaskParts): SQL {
  const mask = serializePhoneMask(parts.slots);
  return sql`phone_mask_match_count(${numberRanges.rangeStart}, ${numberRanges.rangeEnd}, ${mask})`;
}

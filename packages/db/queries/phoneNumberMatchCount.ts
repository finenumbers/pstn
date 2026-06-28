import type { PhoneNumberMaskParts } from "@/lib/phoneNumberMask";
import { EMPTY_PHONE_SLOT, serializePhoneMask } from "@/lib/phoneNumberMask";
import { and, sql, type SQL } from "drizzle-orm";
import { numberRanges } from "../schema";
import type { RangeFilterTable as FilterTable } from "./rangeFilterTable";

export function isAllSubscriberDigitsFixed(parts: PhoneNumberMaskParts): boolean {
  return parts.subscriberSlots.every((slot) => slot !== EMPTY_PHONE_SLOT);
}

export function phoneNumberOverlapSql(
  parts: PhoneNumberMaskParts,
  table: Pick<FilterTable, "rangeStart" | "rangeEnd"> = numberRanges
): SQL {
  if (isAllSubscriberDigitsFixed(parts)) {
    const number = parts.subscriberMin;
    return and(
      sql`${table.rangeStart} <= ${number}`,
      sql`${table.rangeEnd} >= ${number}`
    )!;
  }

  const mask = serializePhoneMask(parts.slots);
  return and(
    sql`${table.rangeStart} <= ${parts.subscriberMax}`,
    sql`${table.rangeEnd} >= ${parts.subscriberMin}`,
    sql`phone_mask_overlaps(${table.rangeStart}, ${table.rangeEnd}, ${mask})`
  )!;
}

/** Per-row match count for any subscriber mask (full or partial wildcards). */
export function phoneNumberPartialMatchCountExpr(
  parts: PhoneNumberMaskParts,
  table: Pick<FilterTable, "rangeStart" | "rangeEnd"> = numberRanges
): SQL {
  const mask = serializePhoneMask(parts.slots);
  return sql`phone_mask_match_count(${table.rangeStart}, ${table.rangeEnd}, ${mask})`;
}

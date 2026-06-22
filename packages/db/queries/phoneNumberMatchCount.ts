import type { PhoneNumberMaskParts } from "@/lib/phoneNumberMask";
import { EMPTY_PHONE_SLOT, serializePhoneMask } from "@/lib/phoneNumberMask";
import { and, sql, type SQL } from "drizzle-orm";
import { numberRanges } from "../schema";

const RANGE_START = '"number_ranges"."range_start"';
const RANGE_END = '"number_ranges"."range_end"';

export function isAllSubscriberDigitsFixed(parts: PhoneNumberMaskParts): boolean {
  return parts.subscriberSlots.every((slot) => slot !== EMPTY_PHONE_SLOT);
}

function narrowFirstSql(currentFirst: string, index: number, digit: number): string {
  const pow = 10 ** (6 - index);
  const blockStep = 10 * pow;
  const offset = digit * pow;

  if (index === 0) {
    return `GREATEST(${currentFirst}, ${offset})`;
  }

  return `CASE
    WHEN mod(${currentFirst}, ${blockStep}) >= ${offset}
      AND mod(${currentFirst}, ${blockStep}) < ${offset + pow}
      THEN ${currentFirst}
    WHEN mod(${currentFirst}, ${blockStep}) < ${offset}
      THEN ((${currentFirst} / ${blockStep})::bigint * ${blockStep} + ${offset})
    ELSE (((${currentFirst} / ${blockStep})::bigint + 1) * ${blockStep} + ${offset})
  END`;
}

function narrowLastSql(currentLast: string, index: number, digit: number): string {
  const pow = 10 ** (6 - index);
  const blockStep = 10 * pow;
  const offset = digit * pow;

  if (index === 0) {
    return `LEAST(${currentLast}, ${offset + pow - 1})`;
  }

  return `CASE
    WHEN mod(${currentLast}, ${blockStep}) >= ${offset}
      AND mod(${currentLast}, ${blockStep}) < ${offset + pow}
      THEN ${currentLast}
    WHEN mod(${currentLast}, ${blockStep}) < ${offset}
      THEN LEAST(
        ${currentLast},
        (((${currentLast} / ${blockStep})::bigint - 1) * ${blockStep} + ${offset} + ${pow - 1})
      )
    ELSE (((${currentLast} / ${blockStep})::bigint * ${blockStep} + ${offset} + ${pow - 1}))
  END`;
}

/** Linear-size SQL: each fixed digit overlaps [range_start, range_end] independently. */
export function phoneNumberOverlapSql(parts: PhoneNumberMaskParts): SQL {
  if (isAllSubscriberDigitsFixed(parts)) {
    const number = parts.subscriberMin;
    return sql.raw(
      `${RANGE_START} <= ${number} AND ${RANGE_END} >= ${number}`
    );
  }

  const digitConditions: SQL[] = [];

  for (let index = 0; index < 7; index++) {
    const slot = parts.subscriberSlots[index];
    if (slot === EMPTY_PHONE_SLOT) continue;

    const digit = Number(slot);
    const firstBound = narrowFirstSql(RANGE_START, index, digit);
    const lastBound = narrowLastSql(RANGE_END, index, digit);
    digitConditions.push(sql.raw(`(${firstBound}) <= (${lastBound})`));
  }

  return and(...digitConditions)!;
}

export function phoneNumberOverlapsExpr(parts: PhoneNumberMaskParts): SQL {
  return phoneNumberOverlapSql(parts);
}

/** Per-row match count for any subscriber mask (full or partial wildcards). */
export function phoneNumberPartialMatchCountExpr(parts: PhoneNumberMaskParts): SQL {
  const mask = serializePhoneMask(parts.slots);
  return sql`phone_mask_match_count(${numberRanges.rangeStart}, ${numberRanges.rangeEnd}, ${mask})`;
}

/** Exact match count SQL — only for fully specified subscriber numbers. */
export function phoneNumberMatchCountExpr(parts: PhoneNumberMaskParts): SQL {
  return phoneNumberPartialMatchCountExpr(parts);
}

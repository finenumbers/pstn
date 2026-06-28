import { isPhoneMaskEmpty } from "@/lib/phoneNumberMask";
import type { FiltersDTO } from "@/packages/shared/contracts/filters.schema";

/** Skip exact total row count when phone mask filter is active (expensive aggregate). */
export function shouldSkipPhoneRangeCount(filters: FiltersDTO): boolean {
  return !isPhoneMaskEmpty(filters.phoneNumber);
}

export const PHONE_CAPACITY_SUMMARY_LIMIT = 10_000;

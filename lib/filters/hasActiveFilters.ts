import type { FiltersDTO } from "@/packages/shared/contracts/filters.schema";
import { isPhoneMaskEmpty } from "@/lib/phoneNumberMask";

export function hasActiveFilters(filters: FiltersDTO): boolean {
  return (
    filters.abc.length > 0 ||
    filters.operator.length > 0 ||
    filters.settlement.length > 0 ||
    filters.region.length > 0 ||
    filters.inn !== "" ||
    filters.rangeStart !== "" ||
    filters.rangeEnd !== "" ||
    filters.capacity !== "" ||
    !isPhoneMaskEmpty(filters.phoneNumber)
  );
}

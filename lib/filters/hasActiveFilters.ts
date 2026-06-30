import type { FiltersDTO } from "@/packages/shared/contracts/filters.schema";
import { isPhoneMaskEmpty } from "@/lib/phoneNumberMask";

export function hasActiveFilters(filters: FiltersDTO): boolean {
  return (
    filters.abc.length > 0 ||
    filters.operator.length > 0 ||
    filters.garTerritory.length > 0 ||
    filters.region.length > 0 ||
    filters.inn.length > 0 ||
    filters.uvrAntifraud.length > 0 ||
    filters.changedFields.length > 0 ||
    filters.rangeStart !== "" ||
    filters.rangeEnd !== "" ||
    filters.capacity !== "" ||
    !isPhoneMaskEmpty(filters.phoneNumber)
  );
}

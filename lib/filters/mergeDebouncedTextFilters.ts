import { isPhoneMaskEmpty } from "@/lib/phoneNumberMask";
import type { FiltersDTO } from "@/packages/shared/contracts/filters.schema";

export type DebouncedTextFilters = Pick<
  FiltersDTO,
  "inn" | "rangeStart" | "rangeEnd" | "capacity" | "phoneNumber"
>;

/** Apply debounced text fields; cleared values flush immediately (e.g. reset filters). */
export function mergeDebouncedTextFilters(
  filters: FiltersDTO,
  debouncedText: DebouncedTextFilters
): FiltersDTO {
  return {
    ...filters,
    inn: filters.inn === "" ? "" : debouncedText.inn,
    rangeStart: filters.rangeStart === "" ? "" : debouncedText.rangeStart,
    rangeEnd: filters.rangeEnd === "" ? "" : debouncedText.rangeEnd,
    capacity: filters.capacity === "" ? "" : debouncedText.capacity,
    phoneNumber: isPhoneMaskEmpty(filters.phoneNumber)
      ? ""
      : debouncedText.phoneNumber,
  };
}

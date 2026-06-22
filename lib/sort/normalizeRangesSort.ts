import {
  DEFAULT_SORT,
  type SortableColumn,
} from "@/packages/shared/contracts/filters.schema";

export type RangesSortItem = { id: SortableColumn; desc: boolean };

/**
 * Normalizes user/API sort for stable keyset pagination and gap-aware display.
 * - Unifies mixed ASC/DESC to the first column's direction.
 * - When ABC is sorted, appends rangeStart with the same direction (keyset-safe).
 */
export function normalizeRangesSort(sort: RangesSortItem[]): RangesSortItem[] {
  if (sort.length === 0) return [...DEFAULT_SORT];

  let normalized = [...sort];

  const allAsc = normalized.every((s) => !s.desc);
  const allDesc = normalized.every((s) => s.desc);
  if (!allAsc && !allDesc) {
    const dir = normalized[0].desc;
    normalized = normalized.map((s) => ({ id: s.id, desc: dir }));
  }

  const abcIndex = normalized.findIndex((s) => s.id === "abc");
  if (abcIndex >= 0) {
    const abc = normalized[abcIndex];
    const rest = normalized.filter((s) => s.id !== "abc" && s.id !== "rangeStart");
    const rangeStart = normalized.find((s) => s.id === "rangeStart");
    normalized = [
      abc,
      rangeStart ?? { id: "rangeStart", desc: abc.desc },
      ...rest,
    ];
  }

  return normalized;
}

export function sortFromSingleColumn(
  columnId: SortableColumn,
  desc: boolean
): RangesSortItem[] {
  return normalizeRangesSort([{ id: columnId, desc }]);
}

/** Gap columns are computed in ABC + range_start ascending order. */
export function isGapCompatibleSort(sort: RangesSortItem[]): boolean {
  const normalized = normalizeRangesSort(sort);
  return (
    normalized.length >= 2 &&
    normalized[0].id === "abc" &&
    !normalized[0].desc &&
    normalized[1].id === "rangeStart" &&
    !normalized[1].desc
  );
}

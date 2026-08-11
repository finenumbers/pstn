import type { NumberRangeRow } from "@/packages/shared/contracts/filters.schema";
import { isFrontirNetworkInn } from "@/lib/table/highlightedInns";

export type RangeRowHighlightKind =
  | "frontier"
  | "abc80"
  | "abc9"
  | "diffAdded"
  | "diffChanged"
  | "diffRemoved";

/** Tailwind classes for UI table rows (current + diff). */
export const RANGE_ROW_HIGHLIGHT_CLASS: Record<RangeRowHighlightKind, string> = {
  frontier: "bg-yellow-300 hover:bg-yellow-300/90",
  abc80: "bg-blue-200 hover:bg-blue-200/90",
  abc9: "bg-green-100 hover:bg-green-100/90",
  diffAdded: "bg-green-600 text-white hover:bg-green-600/90",
  diffChanged: "bg-yellow-400 hover:bg-yellow-400/90",
  diffRemoved: "bg-red-500 text-white hover:bg-red-500/90",
};

/** Excel ARGB fills (solid). */
export const RANGE_ROW_HIGHLIGHT_ARGB: Record<RangeRowHighlightKind, string> = {
  frontier: "FFFFFF00", // bright yellow
  abc80: "FFBFDBFE", // blue-200
  abc9: "FFDCFCE7", // green-100
  diffAdded: "FF16A34A", // green-600
  diffChanged: "FFFACC15", // yellow-400
  diffRemoved: "FFEF4444", // red-500
};

export function isAbc80Series(abc: string): boolean {
  return abc.startsWith("80");
}

export function isNineSeriesAbc(abc: string): boolean {
  return abc.startsWith("9");
}

/**
 * Priority (current): frontier > abc80 > abc9.
 * Diff: changeType only (Frontir/80/9xx disabled, same as UI).
 */
export function getRangeRowHighlight(
  row: Pick<NumberRangeRow, "abc" | "inn" | "changeType">,
  options: { isDiff: boolean }
): RangeRowHighlightKind | null {
  if (options.isDiff) {
    if (row.changeType === "added") return "diffAdded";
    if (row.changeType === "changed") return "diffChanged";
    if (row.changeType === "removed") return "diffRemoved";
    return null;
  }

  if (isFrontirNetworkInn(row.inn)) return "frontier";
  if (isAbc80Series(row.abc)) return "abc80";
  if (isNineSeriesAbc(row.abc)) return "abc9";
  return null;
}

export function getRangeRowHighlightClass(
  row: Pick<NumberRangeRow, "abc" | "inn" | "changeType">,
  options: { isDiff: boolean }
): string | undefined {
  const kind = getRangeRowHighlight(row, options);
  return kind ? RANGE_ROW_HIGHLIGHT_CLASS[kind] : undefined;
}

import type { NumberRangeRow } from "@/packages/shared/contracts/filters.schema";

/**
 * One visible separator per full-data gap in the filtered table.
 * Prefer gapAfter on the upper row; suppress gapBefore when predecessor
 * already draws the line (same gap, avoids double borders/shadows).
 */
export function effectiveAbcRangeGapMarkers(
  row: NumberRangeRow,
  prev?: NumberRangeRow | null
): { gapBefore: boolean; gapAfter: boolean } {
  return {
    gapBefore: row.abcRangeGapBefore && !prev?.abcRangeGapAfter,
    gapAfter: row.abcRangeGapAfter,
  };
}

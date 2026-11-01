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

/**
 * One shadow declaration. Two Tailwind shadow classes overwrite each other,
 * so a row with both edges must not use two classes.
 */
export function numberingGapShadowClass(
  gapBefore: boolean,
  gapAfter: boolean
): string | undefined {
  if (gapBefore && gapAfter) {
    return "shadow-[inset_0_2px_0_0_var(--color-destructive),inset_0_-2px_0_0_var(--color-destructive)]";
  }
  if (gapBefore) return "shadow-[inset_0_2px_0_0_var(--color-destructive)]";
  if (gapAfter) return "shadow-[inset_0_-2px_0_0_var(--color-destructive)]";
  return undefined;
}

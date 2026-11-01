import { describe, expect, it } from "vitest";
import {
  effectiveAbcRangeGapMarkers,
  numberingGapShadowClass,
} from "@/lib/table/abcRangeGapDisplay";
import type { NumberRangeRow } from "@/packages/shared/contracts/filters.schema";

function row(
  rangeStart: number,
  gapBefore = false,
  gapAfter = false
): NumberRangeRow {
  return {
    id: rangeStart,
    abc: "301",
    rangeStart,
    rangeEnd: rangeStart + 999,
    capacity: 1000,
    operator: "ПАО \"Ростелеком\"",
    garTerritory: "Улан-Удэ",
    inn: "",
    legalAddress: null,
    uvrAntifraud: null,
    abcRangeGapBefore: gapBefore,
    abcRangeGapAfter: gapAfter,
  };
}

describe("effectiveAbcRangeGapMarkers", () => {
  it("dedupes when both neighbors mark the same gap", () => {
    const upper = row(2150000, true, true);
    const lower = row(2180000, true, false);
    expect(effectiveAbcRangeGapMarkers(upper, null)).toEqual({
      gapBefore: true,
      gapAfter: true,
    });
    expect(effectiveAbcRangeGapMarkers(lower, upper)).toEqual({
      gapBefore: false,
      gapAfter: false,
    });
  });

  it("shows gapBefore when only lower row marks the gap", () => {
    const upper = row(2180000, true, false);
    const lower = row(2191000, true, false);
    expect(effectiveAbcRangeGapMarkers(lower, upper)).toEqual({
      gapBefore: true,
      gapAfter: false,
    });
  });

  it("draws both gap edges with one shadow declaration", () => {
    const both = numberingGapShadowClass(true, true);
    expect(both).toContain("inset_0_2px_0_0");
    expect(both).toContain("inset_0_-2px_0_0");
    expect(numberingGapShadowClass(true, false)).toBe(
      "shadow-[inset_0_2px_0_0_var(--color-destructive)]"
    );
    expect(numberingGapShadowClass(false, true)).toBe(
      "shadow-[inset_0_-2px_0_0_var(--color-destructive)]"
    );
    expect(numberingGapShadowClass(false, false)).toBeUndefined();
  });

  it("shows gapAfter when successor is hidden by filter", () => {
    const upper = row(2110000, false, true);
    const lower = row(2150000, true, true);
    expect(effectiveAbcRangeGapMarkers(upper, null)).toEqual({
      gapBefore: false,
      gapAfter: true,
    });
    expect(effectiveAbcRangeGapMarkers(lower, upper)).toEqual({
      gapBefore: false,
      gapAfter: true,
    });
  });
});

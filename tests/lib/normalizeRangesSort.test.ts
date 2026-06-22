import { describe, expect, it } from "vitest";
import {
  isGapCompatibleSort,
  normalizeRangesSort,
  sortFromSingleColumn,
} from "@/lib/sort/normalizeRangesSort";
import {
  DEFAULT_SORT,
} from "@/packages/shared/contracts/filters.schema";

describe("normalizeRangesSort", () => {
  it("returns default when empty", () => {
    expect(normalizeRangesSort([])).toEqual(DEFAULT_SORT);
  });

  it("appends rangeStart when sorting by ABC only", () => {
    expect(normalizeRangesSort([{ id: "abc", desc: false }])).toEqual([
      { id: "abc", desc: false },
      { id: "rangeStart", desc: false },
    ]);
  });

  it("keeps rangeStart direction aligned with ABC for keyset", () => {
    expect(normalizeRangesSort([{ id: "abc", desc: true }])).toEqual([
      { id: "abc", desc: true },
      { id: "rangeStart", desc: true },
    ]);
  });

  it("unifies mixed directions from crafted URLs", () => {
    expect(
      normalizeRangesSort([
        { id: "abc", desc: false },
        { id: "capacity", desc: true },
      ])
    ).toEqual([
      { id: "abc", desc: false },
      { id: "rangeStart", desc: false },
      { id: "capacity", desc: false },
    ]);
  });

  it("sortFromSingleColumn normalizes operator-only sort", () => {
    expect(sortFromSingleColumn("operator", true)).toEqual([
      { id: "operator", desc: true },
    ]);
  });
});

describe("isGapCompatibleSort", () => {
  it("is true only for abc asc + rangeStart asc", () => {
    expect(isGapCompatibleSort(DEFAULT_SORT)).toBe(true);
    expect(
      isGapCompatibleSort([
        { id: "abc", desc: true },
        { id: "rangeStart", desc: true },
      ])
    ).toBe(false);
    expect(isGapCompatibleSort([{ id: "capacity", desc: false }])).toBe(false);
  });
});

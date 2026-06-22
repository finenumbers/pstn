import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS } from "@/packages/shared/contracts/filters.schema";
import {
  canResetRangesTable,
  initialTableState,
  isDefaultSort,
} from "@/lib/table/rangesTableState";

describe("isDefaultSort", () => {
  it("is true for default sort", () => {
    expect(isDefaultSort(initialTableState.sorting)).toBe(true);
  });

  it("is false when sort column changes", () => {
    expect(
      isDefaultSort([{ id: "operator", desc: false }])
    ).toBe(false);
  });
});

describe("canResetRangesTable", () => {
  it("is false on initial load with one page", () => {
    expect(
      canResetRangesTable(
        initialTableState.filters,
        1,
        initialTableState.sorting
      )
    ).toBe(false);
  });

  it("is true when any filter is set", () => {
    expect(
      canResetRangesTable(
        { ...DEFAULT_FILTERS, inn: ["1234567890"] },
        1,
        initialTableState.sorting
      )
    ).toBe(true);
    expect(
      canResetRangesTable(
        { ...DEFAULT_FILTERS, abc: ["495"] },
        1,
        initialTableState.sorting
      )
    ).toBe(true);
  });

  it("is true when sort differs from default", () => {
    expect(
      canResetRangesTable(
        DEFAULT_FILTERS,
        1,
        [{ id: "operator", desc: true }]
      )
    ).toBe(true);
  });

  it("is true when extra pages were loaded", () => {
    expect(
      canResetRangesTable(
        DEFAULT_FILTERS,
        2,
        initialTableState.sorting
      )
    ).toBe(true);
    expect(
      canResetRangesTable(
        DEFAULT_FILTERS,
        5,
        initialTableState.sorting
      )
    ).toBe(true);
  });
});

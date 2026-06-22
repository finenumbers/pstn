import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS } from "@/packages/shared/contracts/filters.schema";
import { canResetRangesTable, initialTableState } from "@/lib/table/rangesTableState";

describe("canResetRangesTable", () => {
  it("is false on initial load with one page", () => {
    expect(
      canResetRangesTable(initialTableState.filters, 1)
    ).toBe(false);
  });

  it("is true when any filter is set", () => {
    expect(
      canResetRangesTable(
        { ...DEFAULT_FILTERS, inn: "1234567890" },
        1
      )
    ).toBe(true);
    expect(
      canResetRangesTable(
        { ...DEFAULT_FILTERS, abc: ["495"] },
        1
      )
    ).toBe(true);
  });

  it("is true when extra pages were loaded", () => {
    expect(canResetRangesTable(DEFAULT_FILTERS, 2)).toBe(true);
    expect(canResetRangesTable(DEFAULT_FILTERS, 5)).toBe(true);
  });
});

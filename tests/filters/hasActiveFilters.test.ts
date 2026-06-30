import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS } from "@/packages/shared/contracts/filters.schema";
import { hasActiveFilters } from "@/lib/filters/hasActiveFilters";

describe("hasActiveFilters", () => {
  it("is false for default filters", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it("is true when facet or text filter is set", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, region: ["77"] })).toBe(
      true
    );
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, inn: ["123"] })).toBe(true);
    expect(
      hasActiveFilters({ ...DEFAULT_FILTERS, uvrAntifraud: ["11012"] })
    ).toBe(true);
    expect(
      hasActiveFilters({ ...DEFAULT_FILTERS, changedFields: ["region"] })
    ).toBe(true);
    expect(
      hasActiveFilters({ ...DEFAULT_FILTERS, changeStatus: ["added"] })
    ).toBe(true);
  });
});

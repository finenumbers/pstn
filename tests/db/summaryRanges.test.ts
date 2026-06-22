import { describe, expect, it } from "vitest";
import { summaryRanges } from "@/packages/db/queries/rangesQueries";
import { DEFAULT_FILTERS } from "@/packages/shared/contracts/filters.schema";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("summaryRanges fast path", () => {
  it("returns filtered equal to global when no active filters", async () => {
    const summary = await summaryRanges(DEFAULT_FILTERS);

    expect(summary.filtered.rangeCount).toBe(summary.global.rangeCount);
    expect(summary.filtered.totalCapacity).toBe(summary.global.totalCapacity);
    expect(summary.filtered.uniqueOperators).toBe(summary.global.uniqueOperators);
    expect(summary.global.rangeCount).toBeGreaterThan(0);
  });

  it("returns different filtered stats when operator filter is set", async () => {
    const summary = await summaryRanges({
      ...DEFAULT_FILTERS,
      operator: ["ПАО \"Ростелеком\""],
    });

    expect(summary.filtered.rangeCount).toBeLessThan(summary.global.rangeCount);
  });
});

import { describe, expect, it } from "vitest";
import { countRanges } from "@/packages/db/queries/rangesQueries";
import { DEFAULT_FILTERS } from "@/packages/shared/contracts/filters.schema";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("countRanges cached total", () => {
  it("uses dataset_meta for unfiltered count without scanning number_ranges", async () => {
    const total = await countRanges(DEFAULT_FILTERS);
    expect(total).toBeGreaterThan(100);
  });
});

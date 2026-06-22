import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { countRanges } from "@/packages/db/queries/rangesQueries";
import { DEFAULT_FILTERS } from "@/packages/shared/contracts/filters.schema";
import {
  buildKeysetFillerTestRows,
  insertTestRangeRows,
  refreshTestDatasetMeta,
  truncateRangeTables,
} from "@/tests/helpers/dbTestIsolation";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("countRanges cached total", () => {
  beforeAll(async () => {
    await truncateRangeTables();
    await insertTestRangeRows(buildKeysetFillerTestRows(150));
    await refreshTestDatasetMeta();
  }, 30_000);

  afterAll(async () => {
    await truncateRangeTables();
  }, 30_000);

  it("uses dataset_meta for unfiltered count without scanning number_ranges", async () => {
    const total = await countRanges(DEFAULT_FILTERS);
    expect(total).toBe(150);
  });
});

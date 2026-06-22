import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decodeRangesCursor, encodeRangesCursor } from "@/lib/api/rangesCursor";
import { listRanges } from "@/packages/db/queries/rangesQueries";
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
} from "@/packages/shared/contracts/filters.schema";
import {
  buildKeysetFillerTestRows,
  insertTestRangeRows,
  refreshTestDatasetMeta,
  truncateRangeTables,
} from "@/tests/helpers/dbTestIsolation";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("listRanges keyset pagination", () => {
  beforeAll(async () => {
    await truncateRangeTables();
    await insertTestRangeRows(buildKeysetFillerTestRows(120));
    await refreshTestDatasetMeta();
  }, 30_000);

  afterAll(async () => {
    await truncateRangeTables();
  }, 30_000);

  it("returns consecutive pages without duplicates", async () => {
    const page1 = await listRanges({
      filters: DEFAULT_FILTERS,
      sort: DEFAULT_SORT,
      pageSize: 50,
    });
    expect(page1.hasMore).toBe(true);
    expect(page1.totalRows).toBe(120);

    const cursor = encodeRangesCursor(page1.data[page1.data.length - 1]);
    const decoded = decodeRangesCursor(cursor);
    expect(decoded).not.toBeNull();

    const page2 = await listRanges({
      filters: DEFAULT_FILTERS,
      sort: DEFAULT_SORT,
      pageSize: 50,
      cursor: decoded,
    });

    const page1Ids = new Set(page1.data.map((r) => r.id));
    for (const row of page2.data) {
      expect(page1Ids.has(row.id)).toBe(false);
    }
    expect(
      page2.data[0].rangeStart >= page1.data[page1.data.length - 1].rangeStart
    ).toBe(true);
  });
});

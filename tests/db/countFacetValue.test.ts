import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { countFacetValue } from "@/packages/db/queries/countFacetValue";
import { DEFAULT_FILTERS } from "@/packages/shared/contracts/filters.schema";
import {
  insertTestRangeRows,
  truncateRangeTables,
  type TestRangeRow,
} from "@/tests/helpers/dbTestIsolation";

const GUP_OPERATOR = 'ГУП "БАЙКОНУРСВЯЗЬИНФОРМ"';

const GUP_ROW: TestRangeRow = {
  abc: "900",
  rangeStart: 100_000,
  rangeEnd: 100_999,
  capacity: 1_000,
  operator: GUP_OPERATOR,
  settlement: "Байконур",
  region: "Байконур",
  inn: "9901000027",
};

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("countFacetValue", () => {
  beforeAll(async () => {
    await truncateRangeTables();
    await insertTestRangeRows([GUP_ROW]);
  }, 30_000);

  afterAll(async () => {
    await truncateRangeTables();
  }, 30_000);

  it("returns real row count for selected operator outside top-200 list", async () => {
    const count = await countFacetValue("operator", GUP_OPERATOR, {
      ...DEFAULT_FILTERS,
      operator: [GUP_OPERATOR],
    });
    expect(count).toBe(1);
  });
});

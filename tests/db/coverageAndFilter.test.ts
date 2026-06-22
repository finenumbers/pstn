import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { facetRangesFromDict } from "@/packages/db/queries/facetRangesFromDict";
import { countRanges, listRanges } from "@/packages/db/queries/rangesQueries";
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
} from "@/packages/shared/contracts/filters.schema";
import {
  insertTestRangeRows,
  refreshTestDictTables,
  truncateRangeTables,
  type TestRangeRow,
} from "@/tests/helpers/dbTestIsolation";

const OP_BOTH = 'ПАО "Ростелеком"';
const OP_353_ONLY = 'АО "УФАНЕТ"';

const COVERAGE_AND_TEST_ROWS: TestRangeRow[] = [
  {
    abc: "301",
    rangeStart: 2_100_000,
    rangeEnd: 2_100_999,
    capacity: 1_000,
    operator: OP_BOTH,
    settlement: "г. Уфа",
    region: "Республика Башкортостан",
    inn: "7707049388",
  },
  {
    abc: "353",
    rangeStart: 3_100_000,
    rangeEnd: 3_100_999,
    capacity: 1_000,
    operator: OP_BOTH,
    settlement: "г. Уфа",
    region: "Республика Башкортостан",
    inn: "7707049388",
  },
  {
    abc: "353",
    rangeStart: 3_200_000,
    rangeEnd: 3_200_999,
    capacity: 1_000,
    operator: OP_353_ONLY,
    settlement: "г. Уфа",
    region: "Республика Башкортостан",
    inn: "0274100767",
  },
];

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("coverage AND filters", () => {
  beforeAll(async () => {
    await truncateRangeTables();
    await insertTestRangeRows(COVERAGE_AND_TEST_ROWS);
    await refreshTestDictTables();
  }, 30_000);

  afterAll(async () => {
    await truncateRangeTables();
  }, 30_000);

  it("excludes operators without all selected ABC codes from listRanges", async () => {
    const filters = { ...DEFAULT_FILTERS, abc: ["301", "353"] };
    const result = await listRanges({
      filters,
      sort: DEFAULT_SORT,
      pageSize: 50,
    });

    const operators = new Set(result.data.map((row) => row.operator));
    expect(operators.has(OP_BOTH)).toBe(true);
    expect(operators.has(OP_353_ONLY)).toBe(false);
    expect(result.data.every((row) => ["301", "353"].includes(row.abc))).toBe(
      true
    );
  });

  it("counts only rows from operators with full ABC coverage", async () => {
    const total = await countRanges({ ...DEFAULT_FILTERS, abc: ["301", "353"] });
    expect(total).toBe(2);
  });

  it("operator facet lists only operators with full ABC coverage", async () => {
    const result = await facetRangesFromDict({
      column: "operator",
      filters: { ...DEFAULT_FILTERS, abc: ["301", "353"] },
    });

    const values = result.options.map((option) => option.value);
    expect(values).toContain(OP_BOTH);
    expect(values).not.toContain(OP_353_ONLY);
  });
});

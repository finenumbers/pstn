import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { countFacetValue } from "@/packages/db/queries/countFacetValue";
import { facetInnRanges } from "@/packages/db/queries/facetInnRanges";
import { facetRangesFromDict } from "@/packages/db/queries/facetRangesFromDict";
import {
  countRanges,
  listRanges,
  summaryRanges,
} from "@/packages/db/queries/rangesQueries";
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  FILTER_LIMITS,
} from "@/packages/shared/contracts/filters.schema";
import {
  insertTestRangeRows,
  refreshTestDictTables,
  truncateRangeTables,
  type TestRangeRow,
} from "@/tests/helpers/dbTestIsolation";

const OP_BOTH = 'ПАО "Ростелеком"';
const OP_353_ONLY = 'АО "УФАНЕТ"';
const OP_OTHER = 'ООО "Чужой Оператор"';

const REGION_BOTH = "Республика Башкортостан";
const REGION_353 = "Оренбургская область";
const REGION_OTHER = "г. Москва";

const COVERAGE_AND_TEST_ROWS: TestRangeRow[] = [
  {
    abc: "301",
    rangeStart: 2_100_000,
    rangeEnd: 2_100_999,
    capacity: 1_000,
    operator: OP_BOTH,
    garTerritory: "г. Уфа",
    region: REGION_BOTH,
    inn: "7707049388",
  },
  {
    abc: "353",
    rangeStart: 3_100_000,
    rangeEnd: 3_100_999,
    capacity: 1_000,
    operator: OP_BOTH,
    garTerritory: "г. Уфа",
    region: REGION_BOTH,
    inn: "7707049388",
  },
  {
    abc: "353",
    rangeStart: 3_200_000,
    rangeEnd: 3_200_999,
    capacity: 1_000,
    operator: OP_353_ONLY,
    garTerritory: "г. Оренбург",
    region: REGION_353,
    inn: "0274100767",
  },
  {
    abc: "495",
    rangeStart: 4_100_000,
    rangeEnd: 4_100_999,
    capacity: 1_000,
    operator: OP_OTHER,
    garTerritory: "г. Москва",
    region: REGION_OTHER,
    inn: "7707083893",
  },
];

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("coverage AND and operator OR filters", () => {
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
    expect(values).not.toContain(OP_OTHER);
  });

  it("multi-select operator uses OR and returns union of rows", async () => {
    const filters = {
      ...DEFAULT_FILTERS,
      operator: [OP_BOTH, OP_353_ONLY],
    };
    expect(await countRanges(filters)).toBe(3);

    const result = await listRanges({
      filters,
      sort: DEFAULT_SORT,
      pageSize: 50,
    });
    const operators = new Set(result.data.map((row) => row.operator));
    expect(operators.has(OP_BOTH)).toBe(true);
    expect(operators.has(OP_353_ONLY)).toBe(true);
    expect(operators.has(OP_OTHER)).toBe(false);
  });

  it("intersects ABC Coverage AND with single operator", async () => {
    expect(
      await countRanges({
        ...DEFAULT_FILTERS,
        abc: ["301", "353"],
        operator: [OP_BOTH],
      })
    ).toBe(2);
    expect(
      await countRanges({
        ...DEFAULT_FILTERS,
        abc: ["301", "353"],
        operator: [OP_353_ONLY],
      })
    ).toBe(0);
  });

  it("intersects ABC Coverage AND with multi-operator OR", async () => {
    expect(
      await countRanges({
        ...DEFAULT_FILTERS,
        abc: ["301", "353"],
        operator: [OP_BOTH, OP_353_ONLY],
      })
    ).toBe(2);
  });

  it("summaryRanges multi-operator equals sum of singles", async () => {
    const both = await summaryRanges({
      ...DEFAULT_FILTERS,
      operator: [OP_BOTH],
    });
    const only353 = await summaryRanges({
      ...DEFAULT_FILTERS,
      operator: [OP_353_ONLY],
    });
    const multi = await summaryRanges({
      ...DEFAULT_FILTERS,
      operator: [OP_BOTH, OP_353_ONLY],
    });

    expect(multi.filtered.rangeCount).toBe(
      both.filtered.rangeCount + only353.filtered.rangeCount
    );
    expect(multi.filtered.rangeCount).toBe(3);
  });

  it("accepts maxArrayLength operators and counts only existing", async () => {
    const names = Array.from(
      { length: FILTER_LIMITS.maxArrayLength },
      (_, index) => `ООО "Нет такого ${index}"`
    );
    names[0] = OP_BOTH;
    names[1] = OP_353_ONLY;

    expect(
      await countRanges({
        ...DEFAULT_FILTERS,
        operator: names,
      })
    ).toBe(3);
  });

  it("operator facet with multi-operator selected is not emptied by self filter", async () => {
    const filters = {
      ...DEFAULT_FILTERS,
      operator: [OP_BOTH, OP_353_ONLY],
    };
    const result = await facetRangesFromDict({
      column: "operator",
      filters,
    });
    const values = result.options.map((option) => option.value);
    expect(values).toContain(OP_BOTH);
    expect(values).toContain(OP_353_ONLY);
    expect(values).toContain(OP_OTHER);

    expect(await countFacetValue("operator", OP_BOTH, filters)).toBe(2);
    expect(await countFacetValue("operator", OP_353_ONLY, filters)).toBe(1);
  });

  it("abc facet with multi-operator OR lists codes from the union", async () => {
    const result = await facetRangesFromDict({
      column: "abc",
      filters: {
        ...DEFAULT_FILTERS,
        operator: [OP_BOTH, OP_353_ONLY],
      },
    });
    const byValue = Object.fromEntries(
      result.options.map((option) => [option.value, option.count])
    );
    expect(byValue["301"]).toBe(1);
    expect(byValue["353"]).toBe(2);
    expect(byValue["495"]).toBeUndefined();
  });

  it("abc facet with single operator lists only that operator codes", async () => {
    const result = await facetRangesFromDict({
      column: "abc",
      filters: { ...DEFAULT_FILTERS, operator: [OP_353_ONLY] },
    });
    expect(result.options.map((option) => option.value)).toEqual(["353"]);
  });

  it("region facet with multi-operator OR excludes unrelated regions", async () => {
    const result = await facetRangesFromDict({
      column: "region",
      filters: {
        ...DEFAULT_FILTERS,
        operator: [OP_BOTH, OP_353_ONLY],
      },
    });
    const values = result.options.map((option) => option.value);
    expect(values).toContain(REGION_BOTH);
    expect(values).toContain(REGION_353);
    expect(values).not.toContain(REGION_OTHER);
  });

  it("region facet with ABC Coverage AND lists only covering operators regions", async () => {
    const result = await facetRangesFromDict({
      column: "region",
      filters: { ...DEFAULT_FILTERS, abc: ["301", "353"] },
    });
    const values = result.options.map((option) => option.value);
    expect(values).toEqual([REGION_BOTH]);
  });

  it("inn facet with multi-operator OR lists only those inns", async () => {
    const result = await facetInnRanges({
      filters: {
        ...DEFAULT_FILTERS,
        operator: [OP_BOTH, OP_353_ONLY],
      },
    });
    const values = result.options.map((option) => option.value).sort();
    expect(values).toEqual(["0274100767", "7707049388"]);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, DEFAULT_SORT } from "@/packages/shared/contracts/filters.schema";
import { listRanges } from "@/packages/db/queries/rangesQueries";
import { normalizePhoneMaskQuery, parsePhoneNumberMask, rangeMatchesPhoneMask } from "@/lib/phoneNumberMask";
import {
  insertTestRangeRows,
  truncateRangeTables,
  type TestRangeRow,
} from "@/tests/helpers/dbTestIsolation";

const FALSE_POSITIVE_ROW: TestRangeRow = {
  abc: "383",
  rangeStart: 3_884_000,
  rangeEnd: 3_902_999,
  capacity: 19_000,
  operator: 'ООО "Манго Телеком"',
  garTerritory: "Новосибирск",
  region: "Новосибирская область",
  inn: "7702340000",
};

const STRICT_MATCH_ROW: TestRangeRow = {
  abc: "383",
  rangeStart: 3_999_900,
  rangeEnd: 3_999_929,
  capacity: 30,
  operator: 'ООО "ФРОНТИР НЕТВОРК"',
  garTerritory: "Новосибирск",
  region: "Новосибирская область",
  inn: "5406978329",
};

const SEARCH_ROW: TestRangeRow = {
  abc: "499",
  rangeStart: 6_660_000,
  rangeEnd: 6_660_499,
  capacity: 500,
  operator: 'ООО "ФРОНТИР НЕТВОРК"',
  garTerritory: "Москва",
  region: "ГФЗ Москва",
  inn: "5406978329",
};

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("lookup search by phone mask", () => {
  beforeAll(async () => {
    await truncateRangeTables();
    await insertTestRangeRows([SEARCH_ROW]);
  }, 30_000);

  afterAll(async () => {
    await truncateRangeTables();
  }, 30_000);

  it("returns ranges matching 499X66XXXX mask", async () => {
    const normalized = normalizePhoneMaskQuery("499X66XXXX");
    expect(normalized).toBe("499_66____");

    const { data, totalRows } = await listRanges({
      filters: {
        ...DEFAULT_FILTERS,
        phoneNumber: normalized!,
      },
      sort: DEFAULT_SORT,
      pageSize: 50,
      page: 1,
    });

    expect(totalRows).toBeGreaterThanOrEqual(1);
    expect(data.some((row) => row.abc === "499")).toBe(true);
  });

  it("excludes per-digit false positives for strict ABC+number mask", async () => {
    await truncateRangeTables();
    await insertTestRangeRows([FALSE_POSITIVE_ROW, STRICT_MATCH_ROW]);

    const normalized = normalizePhoneMaskQuery("3833999XXXX");
    expect(normalized).toBe("3833999___");

    const parts = parsePhoneNumberMask(normalized!)!;
    const { data, totalRows } = await listRanges({
      filters: {
        ...DEFAULT_FILTERS,
        phoneNumber: normalized!,
      },
      sort: DEFAULT_SORT,
      pageSize: 50,
      page: 1,
    });

    expect(totalRows).toBe(1);
    expect(data).toHaveLength(1);
    expect(data[0]?.rangeStart).toBe(STRICT_MATCH_ROW.rangeStart);
    for (const row of data) {
      expect(rangeMatchesPhoneMask(row.rangeStart, row.rangeEnd, parts)).toBe(true);
    }
  });

  it("returns empty list for non-matching mask", async () => {
    const normalized = normalizePhoneMaskQuery("301X11XXXX");
    expect(normalized).toBeTruthy();

    const { data, totalRows } = await listRanges({
      filters: {
        ...DEFAULT_FILTERS,
        phoneNumber: normalized!,
      },
      sort: DEFAULT_SORT,
      pageSize: 50,
      page: 1,
    });

    expect(totalRows).toBe(0);
    expect(data).toEqual([]);
  });
});

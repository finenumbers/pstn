import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { lookupByPhone } from "@/packages/db/queries/lookupByPhone";
import {
  insertTestRangeRows,
  truncateRangeTables,
  type TestRangeRow,
} from "@/tests/helpers/dbTestIsolation";

const LOOKUP_ROW: TestRangeRow = {
  abc: "817",
  rangeStart: 5_421_000,
  rangeEnd: 5_422_999,
  capacity: 2_000,
  operator: 'ПАО "Ростелеком"',
  garTerritory: "р-н Никольский",
  region: "Вологодская область",
  inn: "7707049388",
};

const OVERLAP_ROW_A: TestRangeRow = {
  abc: "495",
  rangeStart: 1_000_000,
  rangeEnd: 1_500_000,
  capacity: 500_000,
  operator: 'ООО "Overlap A"',
  garTerritory: "Москва",
  region: "ГФЗ Москва",
  inn: "1111111111",
};

const OVERLAP_ROW_B: TestRangeRow = {
  abc: "495",
  rangeStart: 1_200_000,
  rangeEnd: 1_800_000,
  capacity: 600_000,
  operator: 'ООО "Overlap B"',
  garTerritory: "Москва",
  region: "ГФЗ Москва",
  inn: "2222222222",
};

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("lookupByPhone", () => {
  beforeAll(async () => {
    await truncateRangeTables();
    await insertTestRangeRows([LOOKUP_ROW]);
  }, 30_000);

  afterAll(async () => {
    await truncateRangeTables();
  }, 30_000);

  it("returns matching range for a 10-digit phone inside the range", async () => {
    const result = await lookupByPhone("8175421500");

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.row.abc).toBe("817");
      expect(result.row.operator).toBe('ПАО "Ростелеком"');
      expect(result.row.region).toBe("Вологодская область");
    }
  });

  it("returns not_found when phone is outside all ranges", async () => {
    const result = await lookupByPhone("4950000000");
    expect(result.status).toBe("not_found");
  });

  it("returns ambiguous when multiple ranges match", async () => {
    await truncateRangeTables();
    await insertTestRangeRows([OVERLAP_ROW_A, OVERLAP_ROW_B]);

    const result = await lookupByPhone("4951300000");
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.matchCount).toBe(2);
    }
  });
});

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
    const row = await lookupByPhone("8175421500");

    expect(row).not.toBeNull();
    expect(row?.abc).toBe("817");
    expect(row?.operator).toBe('ПАО "Ростелеком"');
    expect(row?.region).toBe("Вологодская область");
  });

  it("returns null when phone is outside all ranges", async () => {
    const row = await lookupByPhone("4950000000");
    expect(row).toBeNull();
  });
});

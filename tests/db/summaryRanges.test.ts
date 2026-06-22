import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { summaryRanges } from "@/packages/db/queries/rangesQueries";
import { DEFAULT_FILTERS } from "@/packages/shared/contracts/filters.schema";
import {
  buildKeysetFillerTestRows,
  insertTestRangeRows,
  refreshTestDatasetMeta,
  truncateRangeTables,
} from "@/tests/helpers/dbTestIsolation";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("summaryRanges fast path", () => {
  beforeAll(async () => {
    await truncateRangeTables();
    await insertTestRangeRows([
      ...buildKeysetFillerTestRows(9),
      {
        abc: "812",
        rangeStart: 9_000_000,
        rangeEnd: 9_000_999,
        capacity: 1_000,
        operator: 'АО "МТТ"',
        garTerritory: "г. Санкт-Петербург",
        region: "ГФЗ Санкт-Петербург",
        inn: "7705017257",
      },
    ]);
    await refreshTestDatasetMeta();
  }, 30_000);

  afterAll(async () => {
    await truncateRangeTables();
  }, 30_000);

  it("returns filtered equal to global when no active filters", async () => {
    const summary = await summaryRanges(DEFAULT_FILTERS);

    expect(summary.filtered.rangeCount).toBe(summary.global.rangeCount);
    expect(summary.filtered.totalCapacity).toBe(summary.global.totalCapacity);
    expect(summary.filtered.uniqueRegions).toBe(summary.global.uniqueRegions);
    expect(summary.filtered.uniqueGarTerritories).toBe(
      summary.global.uniqueGarTerritories
    );
    expect(summary.filtered.uniqueOperators).toBe(summary.global.uniqueOperators);
    expect(summary.global.rangeCount).toBe(10);
    expect(summary.global.uniqueRegions).toBe(2);
    expect(summary.global.uniqueGarTerritories).toBe(2);
    expect(summary.uvrBinding.registryOperators).toBeGreaterThanOrEqual(0);
  });

  it("returns different filtered stats when operator filter is set", async () => {
    const summary = await summaryRanges({
      ...DEFAULT_FILTERS,
      operator: ['ПАО "Ростелеком"'],
    });

    expect(summary.filtered.rangeCount).toBe(9);
    expect(summary.filtered.uniqueRegions).toBe(1);
    expect(summary.filtered.uniqueGarTerritories).toBe(1);
    expect(summary.global.rangeCount).toBe(10);
    expect(summary.global.uniqueRegions).toBe(2);
    expect(summary.global.uniqueGarTerritories).toBe(2);
  });
});

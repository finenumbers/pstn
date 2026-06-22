import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { refreshUvrAntifraudBinding } from "@/packages/db/queries/refreshUvrAntifraudBinding";
import {
  insertTestRangeRows,
  refreshTestDatasetMeta,
  truncateRangeTables,
} from "@/tests/helpers/dbTestIsolation";
import { pool } from "@/packages/db";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("refreshUvrAntifraudBinding", () => {
  beforeAll(async () => {
    await truncateRangeTables();
    await pool().query(`
      INSERT INTO operators_register (
        id_src, opr_name, opr_nick, inn, bdpn_code, name_brand, source_file
      ) VALUES
        (11012, 'ПАО "Ростелеком"', 'ПАО "Ростелеком"', '7707049388', '', '', 'test-opr.csv')
      ON CONFLICT (id_src) DO UPDATE SET inn = EXCLUDED.inn
    `);
    await insertTestRangeRows([
      {
        abc: "495",
        rangeStart: 1_000_000,
        rangeEnd: 1_000_999,
        capacity: 1_000,
        operator: 'ПАО "Ростелеком"',
        garTerritory: "г. Москва",
        region: "ГФЗ Москва",
        inn: "7707049388",
      },
      {
        abc: "495",
        rangeStart: 1_001_000,
        rangeEnd: 1_001_999,
        capacity: 1_000,
        operator: "Неизвестный",
        garTerritory: "г. Москва",
        region: "ГФЗ Москва",
        inn: "0000000000",
      },
    ]);
    await refreshTestDatasetMeta();
  });

  afterAll(async () => {
    await pool().query("DELETE FROM operators_register WHERE source_file = 'test-opr.csv'");
    await truncateRangeTables();
  });

  it("counts registry operators and matched distinct INNs", async () => {
    const stats = await refreshUvrAntifraudBinding();
    expect(stats.registryOperators).toBeGreaterThanOrEqual(1);
    expect(stats.matchedDistinctInns).toBe(1);
  });
});

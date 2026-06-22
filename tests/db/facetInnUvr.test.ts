import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { facetInnRanges } from "@/packages/db/queries/facetInnRanges";
import { facetUvrAntifraudRanges } from "@/packages/db/queries/facetUvrAntifraudRanges";
import {
  insertTestRangeRows,
  refreshTestDatasetMeta,
  truncateRangeTables,
} from "@/tests/helpers/dbTestIsolation";
import { pool } from "@/packages/db";
import { DEFAULT_FILTERS } from "@/packages/shared/contracts/filters.schema";

describe("facet inn and uvrAntifraud", () => {
  beforeAll(async () => {
    await truncateRangeTables();
    await pool().query(`
      INSERT INTO operators_register (
        id_src, opr_name, opr_nick, inn, bdpn_code, name_brand, source_file
      ) VALUES
        (11012, 'ПАО "Ростелеком"', 'ПАО "Ростелеком"', '7707049388', '', '', 'test-opr.csv'),
        (10920, 'ООО "Скартел"', 'ООО "Скартел"', '7701725181', '', '', 'test-opr.csv')
      ON CONFLICT (id_src) DO UPDATE SET inn = EXCLUDED.inn
    `);
    await insertTestRangeRows([
      {
        abc: "495",
        rangeStart: 1_000_000,
        rangeEnd: 1_000_999,
        capacity: 1_000,
        operator: 'ПАО "Ростелеком"',
        settlement: "г. Москва",
        region: "ГФЗ Москва",
        inn: "7707049388",
      },
      {
        abc: "903",
        rangeStart: 2_000_000,
        rangeEnd: 2_000_999,
        capacity: 1_000,
        operator: 'ООО "Скартел"',
        settlement: "г. Москва",
        region: "ГФЗ Москва",
        inn: "7701725181",
      },
    ]);
    await refreshTestDatasetMeta();
  });

  afterAll(async () => {
    await pool().query("DELETE FROM operators_register WHERE source_file = 'test-opr.csv'");
    await truncateRangeTables();
  });

  it("lists INN facet options with mutual operator filter", async () => {
    const all = await facetInnRanges({ filters: DEFAULT_FILTERS });
    expect(all.options.map((o) => o.value).sort()).toEqual([
      "7701725181",
      "7707049388",
    ]);

    const filtered = await facetInnRanges({
      filters: {
        ...DEFAULT_FILTERS,
        operator: ['ПАО "Ростелеком"'],
      },
    });
    expect(filtered.options).toEqual([
      { value: "7707049388", count: 1 },
    ]);
  });

  it("lists uvrAntifraud facet options with mutual INN filter", async () => {
    const all = await facetUvrAntifraudRanges({ filters: DEFAULT_FILTERS });
    expect(all.options.map((o) => o.value).sort()).toEqual(["10920", "11012"]);

    const filtered = await facetUvrAntifraudRanges({
      filters: {
        ...DEFAULT_FILTERS,
        inn: ["7707049388"],
      },
    });
    expect(filtered.options).toEqual([{ value: "11012", count: 1 }]);
  });
});

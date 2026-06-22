import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { listRanges } from "@/packages/db/queries/rangesQueries";
import {
  insertTestRangeRows,
  refreshTestDatasetMeta,
  truncateRangeTables,
} from "@/tests/helpers/dbTestIsolation";
import { pool } from "@/packages/db";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("uvrAntifraud join", () => {
  beforeAll(async () => {
    await truncateRangeTables();
    await pool().query(`
      INSERT INTO operators_register (
        id_src, opr_name, opr_nick, inn, bdpn_code, name_brand, source_file
      ) VALUES
        (11012, 'ПАО "Ростелеком"', 'ПАО "Ростелеком"', '7707049388', '20=mRTK', '', 'test-opr.csv'),
        (10920, 'ООО "Скартел"', 'ООО "Скартел"', '7701725181', '11=mJUTA', '', 'test-opr.csv')
      ON CONFLICT (id_src) DO UPDATE SET
        opr_name = EXCLUDED.opr_name,
        opr_nick = EXCLUDED.opr_nick,
        inn = EXCLUDED.inn
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
        abc: "903",
        rangeStart: 2_000_000,
        rangeEnd: 2_000_999,
        capacity: 1_000,
        operator: 'ООО "Скартел"',
        garTerritory: "г. Москва",
        region: "ГФЗ Москва",
        inn: "7701725181",
      },
      {
        abc: "903",
        rangeStart: 2_001_000,
        rangeEnd: 2_001_999,
        capacity: 1_000,
        operator: "Неизвестный оператор",
        garTerritory: "г. Москва",
        region: "ГФЗ Москва",
        inn: "0000000000",
      },
      {
        abc: "903",
        rangeStart: 2_002_000,
        rangeEnd: 2_002_999,
        capacity: 1_000,
        operator: "Без ИНН",
        garTerritory: "г. Москва",
        region: "ГФЗ Москва",
        inn: "",
      },
    ]);
    await refreshTestDatasetMeta();
  });

  afterAll(async () => {
    await pool().query("DELETE FROM operators_register WHERE source_file = 'test-opr.csv'");
    await truncateRangeTables();
  });

  it("maps uvrAntifraud from operators_register.id_src by INN", async () => {
    const { data } = await listRanges({
      filters: {
        abc: [],
        operator: [],
        garTerritory: [],
        region: [],
        inn: [],
        uvrAntifraud: [],
        rangeStart: "",
        rangeEnd: "",
        capacity: "",
        phoneNumber: "",
      },
      sort: [
        { id: "abc", desc: false },
        { id: "rangeStart", desc: false },
      ],
      pageSize: 10,
    });

    const byInn = Object.fromEntries(data.map((row) => [row.inn, row.uvrAntifraud]));
    expect(byInn["7707049388"]).toBe(11012);
    expect(byInn["7701725181"]).toBe(10920);
    expect(byInn["0000000000"]).toBeNull();
    expect(byInn[""]).toBeNull();
  });

  it("filters rows by partial uvrAntifraud id_src", async () => {
    const { data, totalRows } = await listRanges({
      filters: {
        abc: [],
        operator: [],
        garTerritory: [],
        region: [],
        inn: [],
        uvrAntifraud: ["11012"],
        rangeStart: "",
        rangeEnd: "",
        capacity: "",
        phoneNumber: "",
      },
      sort: [
        { id: "abc", desc: false },
        { id: "rangeStart", desc: false },
      ],
      pageSize: 10,
    });

    expect(totalRows).toBe(1);
    expect(data).toHaveLength(1);
    expect(data[0]?.inn).toBe("7707049388");
    expect(data[0]?.uvrAntifraud).toBe(11012);
  });
});

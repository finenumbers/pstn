import pg from "pg";
import { pool } from "@/packages/db";

export type TestRangeRow = {
  abc: string;
  rangeStart: number;
  rangeEnd: number;
  capacity: number;
  operator: string;
  garTerritory: string;
  region: string;
  inn: string;
  sourceFile?: string;
};

export async function truncateRangeTables(client?: pg.Pool | pg.PoolClient) {
  const runner = client ?? pool();
  await runner.query(`
    TRUNCATE TABLE
      number_ranges,
      number_ranges_staging,
      operators_dict,
      regions_dict,
      gar_territories_dict,
      abc_dict
    RESTART IDENTITY
  `);
  await runner.query(`
    INSERT INTO dataset_meta (id, total_rows, total_capacity, unique_regions, unique_operators)
    VALUES (1, 0, 0, 0, 0)
    ON CONFLICT (id) DO UPDATE SET
      total_rows = 0,
      total_capacity = 0,
      unique_regions = 0,
      unique_operators = 0,
      last_success_at = NULL,
      last_job_id = NULL
  `);
}

export async function insertTestRangeRows(
  rows: TestRangeRow[],
  client?: pg.Pool | pg.PoolClient
) {
  const runner = client ?? pool();
  for (const row of rows) {
    await runner.query(
      `
      INSERT INTO number_ranges (
        abc, range_start, range_end, capacity, operator,
        gar_territory, region, inn, source_file
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
      [
        row.abc,
        row.rangeStart,
        row.rangeEnd,
        row.capacity,
        row.operator,
        row.garTerritory,
        row.region,
        row.inn,
        row.sourceFile ?? "integration-test",
      ]
    );
  }
}

export async function refreshTestDatasetMeta(client?: pg.Pool | pg.PoolClient) {
  const runner = client ?? pool();
  await runner.query(`
    INSERT INTO dataset_meta (id, total_rows, total_capacity, unique_regions, unique_operators)
    SELECT 1,
      COUNT(*)::int,
      COALESCE(SUM(capacity), 0)::bigint,
      COUNT(DISTINCT region)::int,
      COUNT(DISTINCT operator)::int
    FROM number_ranges
    ON CONFLICT (id) DO UPDATE SET
      total_rows = EXCLUDED.total_rows,
      total_capacity = EXCLUDED.total_capacity,
      unique_regions = EXCLUDED.unique_regions,
      unique_operators = EXCLUDED.unique_operators
  `);
}

export async function refreshTestDictTables(client?: pg.Pool | pg.PoolClient) {
  const runner = client ?? pool();
  await runner.query(`
    INSERT INTO abc_dict (code)
    SELECT DISTINCT abc FROM number_ranges
    ON CONFLICT (code) DO NOTHING
  `);
  await runner.query(`
    INSERT INTO operators_dict (name, inn)
    SELECT DISTINCT operator, inn FROM number_ranges
    ON CONFLICT (name) DO NOTHING
  `);
  await runner.query(`
    INSERT INTO regions_dict (name)
    SELECT DISTINCT region FROM number_ranges
    ON CONFLICT (name) DO NOTHING
  `);
  await runner.query(`
    INSERT INTO gar_territories_dict (name)
    SELECT DISTINCT gar_territory FROM number_ranges
    WHERE gar_territory <> ''
    ON CONFLICT (name) DO NOTHING
  `);
}

/** Rows for abcRangeGapSql integration tests (ABC 301 band). */
export const ABC_301_GAP_TEST_ROWS: TestRangeRow[] = [
  {
    abc: "301",
    rangeStart: 2_110_000,
    rangeEnd: 2_114_999,
    capacity: 5_000,
    operator: 'ПАО "Ростелеком"',
    garTerritory: "г. Улан-Удэ|Республика Бурятия",
    region: "Республика Бурятия",
    inn: "7707049388",
  },
  {
    abc: "301",
    rangeStart: 2_150_000,
    rangeEnd: 2_154_999,
    capacity: 5_000,
    operator: 'ПАО "Ростелеком"',
    garTerritory: "г. Улан-Удэ|Республика Бурятия",
    region: "Республика Бурятия",
    inn: "7707049388",
  },
  {
    abc: "301",
    rangeStart: 2_180_000,
    rangeEnd: 2_189_999,
    capacity: 10_000,
    operator: 'ПАО "Ростелеком"',
    garTerritory: "г. Улан-Удэ|Республика Бурятия",
    region: "Республика Бурятия",
    inn: "7707049388",
  },
  {
    abc: "301",
    rangeStart: 2_190_000,
    rangeEnd: 2_190_089,
    capacity: 90,
    operator: 'АО "МТТ"',
    garTerritory: "г. Улан-Удэ|Республика Бурятия",
    region: "Республика Бурятия",
    inn: "7705017257",
  },
  {
    abc: "301",
    rangeStart: 2_191_000,
    rangeEnd: 2_199_999,
    capacity: 9_000,
    operator: 'АО "МТТ"',
    garTerritory: "г. Улан-Удэ|Республика Бурятия",
    region: "Республика Бурятия",
    inn: "7705017257",
  },
  {
    abc: "301",
    rangeStart: 2_200_000,
    rangeEnd: 2_209_999,
    capacity: 10_000,
    operator: 'АО "МТТ"',
    garTerritory: "г. Улан-Удэ|Республика Бурятия",
    region: "Республика Бурятия",
    inn: "7705017257",
  },
];

export function buildKeysetFillerTestRows(count: number): TestRangeRow[] {
  const rows: TestRangeRow[] = [];
  for (let i = 0; i < count; i += 1) {
    const start = 3_000_000 + i * 1_000;
    rows.push({
      abc: "495",
      rangeStart: start,
      rangeEnd: start + 999,
      capacity: 1_000,
      operator: 'ПАО "Ростелеком"',
      garTerritory: "Город Москва",
      region: "ГФЗ Москва",
      inn: "7707049388",
    });
  }
  return rows;
}

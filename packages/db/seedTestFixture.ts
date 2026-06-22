import pg from "pg";
import { refreshAbcRangeGaps } from "@/packages/db/queries/refreshAbcRangeGaps";

export const TEST_FIXTURE_SOURCE_FILE = "test-fixture";
const ROSTELECOM = 'ПАО "Ростелеком"';
const MTT = 'АО "МТТ"';
const GUP_BAIKONUR = 'ГУП "БАЙКОНУРСВЯЗЬИНФОРМ"';

type FixtureRow = {
  abc: string;
  rangeStart: number;
  rangeEnd: number;
  capacity: number;
  operator: string;
  settlement: string;
  region: string;
  inn: string;
};

const ABC_301_GAP_ROWS: FixtureRow[] = [
  {
    abc: "301",
    rangeStart: 2_110_000,
    rangeEnd: 2_114_999,
    capacity: 5_000,
    operator: ROSTELECOM,
    settlement: "г. Улан-Удэ",
    region: "Республика Бурятия",
    inn: "7707049388",
  },
  {
    abc: "301",
    rangeStart: 2_150_000,
    rangeEnd: 2_154_999,
    capacity: 5_000,
    operator: ROSTELECOM,
    settlement: "г. Улан-Удэ",
    region: "Республика Бурятия",
    inn: "7707049388",
  },
  {
    abc: "301",
    rangeStart: 2_180_000,
    rangeEnd: 2_189_999,
    capacity: 10_000,
    operator: ROSTELECOM,
    settlement: "г. Улан-Удэ",
    region: "Республика Бурятия",
    inn: "7707049388",
  },
  {
    abc: "301",
    rangeStart: 2_190_000,
    rangeEnd: 2_190_089,
    capacity: 90,
    operator: MTT,
    settlement: "г. Улан-Удэ",
    region: "Республика Бурятия",
    inn: "7705017257",
  },
  {
    abc: "301",
    rangeStart: 2_191_000,
    rangeEnd: 2_199_999,
    capacity: 9_000,
    operator: MTT,
    settlement: "г. Улан-Удэ",
    region: "Республика Бурятия",
    inn: "7705017257",
  },
  {
    abc: "301",
    rangeStart: 2_200_000,
    rangeEnd: 2_209_999,
    capacity: 10_000,
    operator: MTT,
    settlement: "г. Улан-Удэ",
    region: "Республика Бурятия",
    inn: "7705017257",
  },
];

function buildMttRows(count: number): FixtureRow[] {
  const rows: FixtureRow[] = [];
  for (let index = 0; index < count; index++) {
    const rangeStart = 3_000_000 + index * 1_000;
    rows.push({
      abc: "495",
      rangeStart,
      rangeEnd: rangeStart + 999,
      capacity: 1_000,
      operator: MTT,
      settlement: "г. Москва",
      region: "ГФЗ Москва",
      inn: "7705017257",
    });
  }
  return rows;
}

function buildKeysetFillerRows(count: number): FixtureRow[] {
  const rows: FixtureRow[] = [];
  for (let index = 0; index < count; index++) {
    const rangeStart = 10_000_000 + index * 1_000;
    rows.push({
      abc: "812",
      rangeStart,
      rangeEnd: rangeStart + 999,
      capacity: 1_000,
      operator: ROSTELECOM,
      settlement: "г. Санкт-Петербург",
      region: "ГФЗ Санкт-Петербург",
      inn: "7707049388",
    });
  }
  return rows;
}

export function buildTestFixtureRows(): FixtureRow[] {
  return [
    ...ABC_301_GAP_ROWS,
    ...buildMttRows(50),
    ...buildKeysetFillerRows(120),
    {
      abc: "900",
      rangeStart: 100_000,
      rangeEnd: 100_999,
      capacity: 1_000,
      operator: GUP_BAIKONUR,
      settlement: "Байконур",
      region: "Байконур",
      inn: "9901000027",
    },
  ];
}

async function refreshDictionaries(client: pg.Client): Promise<void> {
  await client.query(`
    INSERT INTO operators_dict (name, inn)
    SELECT DISTINCT operator, inn FROM number_ranges
    ON CONFLICT (name) DO NOTHING
  `);
  await client.query(`
    INSERT INTO settlements_dict (name)
    SELECT DISTINCT settlement FROM number_ranges
    WHERE settlement <> ''
    ON CONFLICT (name) DO NOTHING
  `);
  await client.query(`
    INSERT INTO regions_dict (name)
    SELECT DISTINCT region FROM number_ranges
    ON CONFLICT (name) DO NOTHING
  `);
  await client.query(`
    INSERT INTO abc_dict (code)
    SELECT DISTINCT abc FROM number_ranges
    ON CONFLICT (code) DO NOTHING
  `);
}

async function refreshDatasetMeta(client: pg.Client): Promise<void> {
  const stats = await client.query<{
    total_rows: number;
    total_capacity: string;
    unique_operators: number;
  }>(`
    SELECT
      COUNT(*)::int AS total_rows,
      COALESCE(SUM(capacity), 0)::bigint AS total_capacity,
      COUNT(DISTINCT operator)::int AS unique_operators
    FROM number_ranges
  `);
  const row = stats.rows[0];
  await client.query(
    `
    INSERT INTO dataset_meta (id, total_rows, total_capacity, unique_operators)
    VALUES (1, $1, $2, $3)
    ON CONFLICT (id) DO UPDATE SET
      total_rows = EXCLUDED.total_rows,
      total_capacity = EXCLUDED.total_capacity,
      unique_operators = EXCLUDED.unique_operators
  `,
    [
      row?.total_rows ?? 0,
      Number(row?.total_capacity ?? 0),
      row?.unique_operators ?? 0,
    ]
  );
}

export async function seedTestFixture(): Promise<number> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const rows = buildTestFixtureRows();
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      TRUNCATE TABLE
        number_ranges,
        number_ranges_staging,
        operators_dict,
        regions_dict,
        settlements_dict,
        abc_dict
      RESTART IDENTITY
    `);

    for (const row of rows) {
      await client.query(
        `
        INSERT INTO number_ranges (
          abc, range_start, range_end, capacity, operator,
          settlement, region, inn, source_file
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
        [
          row.abc,
          row.rangeStart,
          row.rangeEnd,
          row.capacity,
          row.operator,
          row.settlement,
          row.region,
          row.inn,
          TEST_FIXTURE_SOURCE_FILE,
        ]
      );
    }

    await refreshDictionaries(client);
    await refreshAbcRangeGaps();
    await refreshDatasetMeta(client);

    return rows.length;
  } finally {
    await client.end();
  }
}

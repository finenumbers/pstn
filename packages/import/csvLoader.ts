import { importDb, importPool, pool } from "@/packages/db";
import { numberRangesStaging } from "@/packages/db/schema";
import { RANGES_STAGING_TABLE } from "@/packages/db/importTables";
import type { ParsedRangeRow } from "./csvParser";

export async function clearStaging(): Promise<void> {
  await importPool().query(`TRUNCATE TABLE ${RANGES_STAGING_TABLE} RESTART IDENTITY`);
}

export async function insertBatch(
  rows: ParsedRangeRow[],
  sourceFile: string
): Promise<void> {
  if (rows.length === 0) return;

  const values = rows.map((r) => ({
    abc: r.abc,
    rangeStart: r.rangeStart,
    rangeEnd: r.rangeEnd,
    capacity: r.capacity,
    operator: r.operator,
    garTerritory: r.garTerritory,
    region: r.region,
    inn: r.inn,
    sourceFile,
  }));

  await importDb.insert(numberRangesStaging).values(values);
}

export async function swapStagingToProduction(): Promise<void> {
  const client = await importPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`ALTER TABLE number_ranges RENAME TO number_ranges_swap_old`);
    await client.query(
      `ALTER TABLE ${RANGES_STAGING_TABLE} RENAME TO number_ranges`
    );
    await client.query(
      `ALTER TABLE number_ranges_swap_old RENAME TO ${RANGES_STAGING_TABLE}`
    );
    await client.query(`TRUNCATE TABLE ${RANGES_STAGING_TABLE} RESTART IDENTITY`);
    await client.query(`
      TRUNCATE operators_dict, regions_dict, gar_territories_dict, abc_dict RESTART IDENTITY
    `);
    await client.query(`
      INSERT INTO operators_dict (name, inn)
      SELECT operator, MAX(inn)
      FROM number_ranges
      GROUP BY operator
    `);
    await client.query(`
      INSERT INTO gar_territories_dict (name)
      SELECT DISTINCT gar_territory FROM number_ranges
      WHERE gar_territory <> ''
    `);
    await client.query(`
      INSERT INTO regions_dict (name)
      SELECT DISTINCT region FROM number_ranges
    `);
    await client.query(`
      INSERT INTO abc_dict (code)
      SELECT DISTINCT abc FROM number_ranges
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function rebuildDictionaries(): Promise<void> {
  const client = await importPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      TRUNCATE operators_dict, regions_dict, gar_territories_dict, abc_dict RESTART IDENTITY
    `);
    await client.query(`
      INSERT INTO operators_dict (name, inn)
      SELECT operator, MAX(inn)
      FROM number_ranges
      GROUP BY operator
    `);
    await client.query(`
      INSERT INTO gar_territories_dict (name)
      SELECT DISTINCT gar_territory FROM number_ranges
      WHERE gar_territory <> ''
    `);
    await client.query(`
      INSERT INTO regions_dict (name)
      SELECT DISTINCT region FROM number_ranges
    `);
    await client.query(`
      INSERT INTO abc_dict (code)
      SELECT DISTINCT abc FROM number_ranges
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function refreshDatasetGlobalStats(): Promise<{
  totalRows: number;
  totalCapacity: number;
  uniqueRegions: number;
  uniqueGarTerritories: number;
  uniqueOperators: number;
}> {
  const p = pool();
  const result = await p.query<{
    total_rows: number;
    total_capacity: string;
    unique_regions: number;
    unique_gar_territories: number;
    unique_operators: number;
  }>(`
    SELECT
      COUNT(*)::int AS total_rows,
      COALESCE(SUM(capacity), 0)::bigint AS total_capacity,
      COUNT(DISTINCT region)::int AS unique_regions,
      COUNT(DISTINCT gar_territory)::int AS unique_gar_territories,
      COUNT(DISTINCT operator)::int AS unique_operators
    FROM number_ranges
  `);
  const row = result.rows[0];
  const stats = {
    totalRows: row?.total_rows ?? 0,
    totalCapacity: Number(row?.total_capacity ?? 0),
    uniqueRegions: row?.unique_regions ?? 0,
    uniqueGarTerritories: row?.unique_gar_territories ?? 0,
    uniqueOperators: row?.unique_operators ?? 0,
  };

  await p.query(
    `
    UPDATE dataset_meta
    SET
      total_rows = $1,
      total_capacity = $2,
      unique_regions = $3,
      unique_gar_territories = $4,
      unique_operators = $5
    WHERE id = 1
  `,
    [
      stats.totalRows,
      stats.totalCapacity,
      stats.uniqueRegions,
      stats.uniqueGarTerritories,
      stats.uniqueOperators,
    ]
  );

  return stats;
}

export async function analyzeRanges(): Promise<void> {
  await importPool().query("ANALYZE number_ranges");
}

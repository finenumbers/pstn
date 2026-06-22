import { pool, importPool } from "../index";
import {
  IMPORT_RANGES_TABLES,
  RANGES_STAGING_TABLE,
  RANGES_TABLE,
  type ImportRangesTable,
} from "@/packages/db/importTables";

function assertImportRangesTable(tableName: string): ImportRangesTable {
  if (!(IMPORT_RANGES_TABLES as readonly string[]).includes(tableName)) {
    throw new Error(`Invalid ranges table: ${tableName}`);
  }
  return tableName as ImportRangesTable;
}

/**
 * Recompute materialized ABC gap flags for all rows (full-data order per ABC).
 * Run after bulk import; O(n) single pass via window functions.
 */
export async function refreshAbcRangeGaps(
  tableName: ImportRangesTable = RANGES_TABLE
): Promise<void> {
  const table = assertImportRangesTable(tableName);
  const queryPool = table === RANGES_STAGING_TABLE ? importPool() : pool();

  await queryPool.query(`
    UPDATE ${table} nr
    SET
      abc_gap_before = gaps.gap_before,
      abc_gap_after = gaps.gap_after
    FROM (
      SELECT
        id,
        COALESCE(prev_range_end + 1 < range_start, false) AS gap_before,
        COALESCE(range_end + 1 < next_range_start, false) AS gap_after
      FROM (
        SELECT
          id,
          range_start,
          range_end,
          LAG(range_end) OVER (PARTITION BY abc ORDER BY range_start) AS prev_range_end,
          LEAD(range_start) OVER (PARTITION BY abc ORDER BY range_start) AS next_range_start
        FROM ${table}
      ) ordered
    ) gaps
    WHERE nr.id = gaps.id
  `);
}

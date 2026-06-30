import { eq } from "drizzle-orm";
import { db, importPool } from "@/packages/db";
import {
  datasetMeta,
  numberRangesStaging,
} from "@/packages/db/schema";
import type { SourceFileHashes } from "@/packages/import/sourceFileHash";
import type { RangeRecord } from "@/packages/import/rangeDatasetDiff";

const IMPORT_DIFF_OLD_TABLE = "import_diff_old";

export async function prepareImportDiffOldTable(): Promise<void> {
  await importPool().query(`
    DROP TABLE IF EXISTS ${IMPORT_DIFF_OLD_TABLE};
    CREATE UNLOGGED TABLE ${IMPORT_DIFF_OLD_TABLE} AS
    SELECT
      abc, range_start, range_end, capacity, operator, region, gar_territory, inn,
      abc_gap_before, abc_gap_after, source_file, created_at
    FROM number_ranges;
    CREATE INDEX import_diff_old_abc_start_idx ON ${IMPORT_DIFF_OLD_TABLE} (abc, range_start);
  `);
}

export async function dropImportDiffOldTable(): Promise<void> {
  await importPool().query(`DROP TABLE IF EXISTS ${IMPORT_DIFF_OLD_TABLE}`);
}

export async function loadImportDiffOldRanges(): Promise<RangeRecord[]> {
  const result = await importPool().query<{
    abc: string;
    range_start: string;
    range_end: string;
    capacity: number;
    operator: string;
    region: string;
    gar_territory: string;
    inn: string;
  }>(`
    SELECT abc, range_start, range_end, capacity, operator, region, gar_territory, inn
    FROM ${IMPORT_DIFF_OLD_TABLE}
  `);

  return result.rows.map((row) => ({
    abc: row.abc,
    rangeStart: Number(row.range_start),
    rangeEnd: Number(row.range_end),
    capacity: row.capacity,
    operator: row.operator,
    region: row.region,
    garTerritory: row.gar_territory,
    inn: row.inn,
  }));
}

export async function loadStagingRangesForDiff(): Promise<RangeRecord[]> {
  const rows = await db
    .select({
      abc: numberRangesStaging.abc,
      rangeStart: numberRangesStaging.rangeStart,
      rangeEnd: numberRangesStaging.rangeEnd,
      capacity: numberRangesStaging.capacity,
      operator: numberRangesStaging.operator,
      region: numberRangesStaging.region,
      garTerritory: numberRangesStaging.garTerritory,
      inn: numberRangesStaging.inn,
    })
    .from(numberRangesStaging);

  return rows;
}

export async function getStoredSourceHashes(): Promise<SourceFileHashes | null> {
  const rows = await db
    .select({ sourceHashes: datasetMeta.sourceHashes })
    .from(datasetMeta)
    .where(eq(datasetMeta.id, 1));
  const value = rows[0]?.sourceHashes;
  if (!value || typeof value !== "object") return null;
  return value as SourceFileHashes;
}

export async function saveDatasetMetaAfterImport(params: {
  jobId: string;
  finishedAt: Date;
  sourceHashes: SourceFileHashes;
  stats: {
    totalRows: number;
    totalCapacity: number;
    uniqueRegions: number;
    uniqueGarTerritories: number;
    uniqueOperators: number;
  };
}): Promise<void> {
  await db
    .insert(datasetMeta)
    .values({
      id: 1,
      lastSuccessAt: params.finishedAt,
      lastJobId: params.jobId,
      totalRows: params.stats.totalRows,
      totalCapacity: params.stats.totalCapacity,
      uniqueRegions: params.stats.uniqueRegions,
      uniqueGarTerritories: params.stats.uniqueGarTerritories,
      uniqueOperators: params.stats.uniqueOperators,
      sourceHashes: params.sourceHashes,
    })
    .onConflictDoUpdate({
      target: datasetMeta.id,
      set: {
        lastSuccessAt: params.finishedAt,
        lastJobId: params.jobId,
        totalRows: params.stats.totalRows,
        totalCapacity: params.stats.totalCapacity,
        uniqueRegions: params.stats.uniqueRegions,
        uniqueGarTerritories: params.stats.uniqueGarTerritories,
        uniqueOperators: params.stats.uniqueOperators,
        sourceHashes: params.sourceHashes,
      },
    });
}

export function mskLoadDateKey(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
}

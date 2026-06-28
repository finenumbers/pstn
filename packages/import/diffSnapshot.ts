import { eq } from "drizzle-orm";
import { db, importPool } from "@/packages/db";
import {
  datasetMeta,
  numberRangesStaging,
} from "@/packages/db/schema";
import type { DiffSegment } from "@/packages/import/rangeDatasetDiff";
import type { SourceFileHashes } from "@/packages/import/sourceFileHash";
import type { RangeRecord } from "@/packages/import/rangeDatasetDiff";

const IMPORT_DIFF_OLD_TABLE = "import_diff_old";

export async function prepareImportDiffOldTable(): Promise<void> {
  await importPool().query(`
    DROP TABLE IF EXISTS ${IMPORT_DIFF_OLD_TABLE};
    CREATE UNLOGGED TABLE ${IMPORT_DIFF_OLD_TABLE} (
      LIKE number_ranges INCLUDING DEFAULTS EXCLUDING IDENTITY
    );
    INSERT INTO ${IMPORT_DIFF_OLD_TABLE} (
      abc, range_start, range_end, capacity, operator, region, gar_territory, inn,
      abc_gap_before, abc_gap_after, source_file, created_at
    )
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

export async function saveDiffSnapshot(params: {
  jobId: string;
  loadDate: string;
  segments: DiffSegment[];
  counts: { added: number; changed: number; removed: number };
}): Promise<string | null> {
  if (params.segments.length === 0) {
    return null;
  }

  const client = await importPool().connect();
  try {
    await client.query("BEGIN");

    const snapshotResult = await client.query<{ id: string }>(
      `
      INSERT INTO dataset_snapshots (
        kind, load_date, job_id, added_count, changed_count, removed_count
      )
      VALUES ('diff', $1::date, $2, $3, $4, $5)
      ON CONFLICT (load_date) DO UPDATE SET
        job_id = EXCLUDED.job_id,
        added_count = EXCLUDED.added_count,
        changed_count = EXCLUDED.changed_count,
        removed_count = EXCLUDED.removed_count
      RETURNING id
    `,
      [
        params.loadDate,
        params.jobId,
        params.counts.added,
        params.counts.changed,
        params.counts.removed,
      ]
    );

    const snapshotId = snapshotResult.rows[0]!.id;
    await client.query(`DELETE FROM number_range_diffs WHERE snapshot_id = $1`, [
      snapshotId,
    ]);

    const batchSize = 500;
    for (let offset = 0; offset < params.segments.length; offset += batchSize) {
      const batch = params.segments.slice(offset, offset + batchSize);
      const values: unknown[] = [];
      const placeholders: string[] = [];

      batch.forEach((segment, index) => {
        const base = index * 17;
        placeholders.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17})`
        );
        values.push(
          snapshotId,
          segment.changeType,
          segment.abc,
          segment.rangeStart,
          segment.rangeEnd,
          segment.capacity,
          segment.operator,
          segment.region,
          segment.garTerritory,
          segment.inn,
          segment.prevRangeStart ?? null,
          segment.prevRangeEnd ?? null,
          segment.prevCapacity ?? null,
          segment.prevOperator ?? null,
          segment.prevRegion ?? null,
          segment.prevGarTerritory ?? null,
          segment.prevInn ?? null
        );
      });

      await client.query(
        `
        INSERT INTO number_range_diffs (
          snapshot_id, change_type, abc, range_start, range_end, capacity,
          operator, region, gar_territory, inn,
          prev_range_start, prev_range_end, prev_capacity,
          prev_operator, prev_region, prev_gar_territory, prev_inn
        )
        VALUES ${placeholders.join(", ")}
      `,
        values
      );
    }

    await client.query("COMMIT");
    return snapshotId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function mskLoadDateKey(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
}

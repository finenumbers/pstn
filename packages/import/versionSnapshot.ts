import { importPool } from "@/packages/db";
import type { DiffSegment } from "@/packages/import/rangeDatasetDiff";
import type pg from "pg";

export type VersionSnapshotMode = "baseline" | "full_and_diff";

const FULL_COPY_BATCH_SIZE = 5000;

type ImportPoolClient = pg.PoolClient;

async function insertDiffSegments(
  client: ImportPoolClient,
  snapshotId: string,
  segments: DiffSegment[]
): Promise<void> {
  await client.query(`DELETE FROM number_range_diffs WHERE snapshot_id = $1`, [
    snapshotId,
  ]);

  const batchSize = 500;
  for (let offset = 0; offset < segments.length; offset += batchSize) {
    const batch = segments.slice(offset, offset + batchSize);
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
}

async function copyProductionToFullSnapshot(
  client: ImportPoolClient,
  snapshotId: string
): Promise<number> {
  await client.query(
    `DELETE FROM number_range_full_snapshots WHERE snapshot_id = $1`,
    [snapshotId]
  );

  const countResult = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM number_ranges`
  );
  const totalRows = Number(countResult.rows[0]?.count ?? 0);
  if (totalRows === 0) {
    return 0;
  }

  let copied = 0;
  while (copied < totalRows) {
    await client.query(
      `
      INSERT INTO number_range_full_snapshots (
        snapshot_id, abc, range_start, range_end, capacity,
        operator, region, gar_territory, inn,
        abc_gap_before, abc_gap_after, source_file
      )
      SELECT
        $1,
        abc, range_start, range_end, capacity,
        operator, region, gar_territory, inn,
        abc_gap_before, abc_gap_after, source_file
      FROM number_ranges
      ORDER BY abc, range_start
      LIMIT $2 OFFSET $3
    `,
      [snapshotId, FULL_COPY_BATCH_SIZE, copied]
    );
    copied += FULL_COPY_BATCH_SIZE;
  }

  return totalRows;
}

export async function saveVersionSnapshot(params: {
  jobId: string;
  loadDate: string;
  mode: VersionSnapshotMode;
  segments?: DiffSegment[];
  counts?: { added: number; changed: number; removed: number };
}): Promise<string> {
  const hasDiff = params.mode === "full_and_diff";
  const segments = params.segments ?? [];
  const counts = params.counts ?? { added: 0, changed: 0, removed: 0 };

  if (hasDiff && segments.length === 0) {
    throw new Error("full_and_diff mode requires non-empty diff segments");
  }

  const client = await importPool().connect();
  try {
    await client.query("BEGIN");

    const snapshotResult = await client.query<{ id: string }>(
      `
      INSERT INTO dataset_snapshots (
        kind, load_date, job_id,
        added_count, changed_count, removed_count,
        has_full, has_diff, row_count
      )
      VALUES ('version', $1::date, $2, $3, $4, $5, true, $6, 0)
      ON CONFLICT (load_date) DO UPDATE SET
        job_id = EXCLUDED.job_id,
        added_count = EXCLUDED.added_count,
        changed_count = EXCLUDED.changed_count,
        removed_count = EXCLUDED.removed_count,
        has_full = true,
        has_diff = EXCLUDED.has_diff
      RETURNING id
    `,
      [
        params.loadDate,
        params.jobId,
        counts.added,
        counts.changed,
        counts.removed,
        hasDiff,
      ]
    );

    const snapshotId = snapshotResult.rows[0]!.id;
    const rowCount = await copyProductionToFullSnapshot(client, snapshotId);

    await client.query(
      `UPDATE dataset_snapshots SET row_count = $2 WHERE id = $1`,
      [snapshotId, rowCount]
    );

    if (hasDiff) {
      await insertDiffSegments(client, snapshotId, segments);
    } else {
      await client.query(`DELETE FROM number_range_diffs WHERE snapshot_id = $1`, [
        snapshotId,
      ]);
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

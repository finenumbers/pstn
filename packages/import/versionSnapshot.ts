import { importPool } from "@/packages/db";
import type { DiffSegment } from "@/packages/import/rangeDatasetDiff";
import type pg from "pg";

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
      const base = index * 15;
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15})`
      );
      values.push(
        snapshotId,
        segment.changeType,
        segment.abc,
        segment.rangeStart,
        segment.rangeEnd,
        segment.capacity,
        segment.operator,
        segment.garTerritory,
        segment.inn,
        segment.prevRangeStart ?? null,
        segment.prevRangeEnd ?? null,
        segment.prevCapacity ?? null,
        segment.prevOperator ?? null,
        segment.prevGarTerritory ?? null,
        segment.prevInn ?? null
      );
    });

    await client.query(
      `
      INSERT INTO number_range_diffs (
        snapshot_id, change_type, abc, range_start, range_end, capacity,
        operator, gar_territory, inn,
        prev_range_start, prev_range_end, prev_capacity,
        prev_operator, prev_gar_territory, prev_inn
      )
      VALUES ${placeholders.join(", ")}
    `,
      values
    );
  }
}

export async function saveDiffSnapshot(params: {
  jobId: string;
  loadDate: string;
  segments: DiffSegment[];
  counts: { added: number; changed: number; removed: number };
}): Promise<string> {
  if (params.segments.length === 0) {
    throw new Error("diff snapshot requires non-empty segments");
  }

  const client = await importPool().connect();
  try {
    await client.query("BEGIN");

    const snapshotResult = await client.query<{ id: string }>(
      `
      INSERT INTO dataset_snapshots (
        kind, load_date, job_id,
        added_count, changed_count, removed_count,
        has_diff
      )
      VALUES ('diff', $1::date, $2, $3, $4, $5, true)
      ON CONFLICT (load_date) DO UPDATE SET
        kind = 'diff',
        job_id = EXCLUDED.job_id,
        added_count = EXCLUDED.added_count,
        changed_count = EXCLUDED.changed_count,
        removed_count = EXCLUDED.removed_count,
        has_diff = true
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
    await insertDiffSegments(client, snapshotId, params.segments);

    await client.query("COMMIT");
    return snapshotId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

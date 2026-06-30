import { and, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "../index";
import { DatasetNotFoundError } from "@/packages/db/errors/datasetErrors";
import { datasetMeta, datasetSnapshots } from "../schema";
import {
  DATASET_CURRENT_ID,
  formatDatasetLabel,
  type ChangeDatesResponse,
  type DatasetChangeDateItem,
  type DatasetListItem,
  type DatasetRef,
} from "@/packages/shared/contracts/dataset.schema";
import { mskLoadDateKey } from "@/packages/import/diffSnapshot";

export async function getCurrentLoadDate(): Promise<string | null> {
  const metaRows = await db
    .select({ lastSuccessAt: datasetMeta.lastSuccessAt })
    .from(datasetMeta)
    .where(eq(datasetMeta.id, 1));
  const meta = metaRows[0];
  return meta?.lastSuccessAt ? mskLoadDateKey(meta.lastSuccessAt) : null;
}

export async function listDatasetItems(): Promise<DatasetListItem[]> {
  const currentLoadDate = await getCurrentLoadDate();

  const items: DatasetListItem[] = [];

  if (currentLoadDate) {
    items.push({
      id: DATASET_CURRENT_ID,
      kind: "current",
      label: formatDatasetLabel("current", currentLoadDate),
      loadDate: currentLoadDate,
    });
  }

  const snapshots = await db
    .select()
    .from(datasetSnapshots)
    .where(eq(datasetSnapshots.hasDiff, true))
    .orderBy(desc(datasetSnapshots.loadDate));

  for (const snapshot of snapshots) {
    items.push({
      id: snapshot.id,
      kind: "diff",
      label: formatDatasetLabel("diff", snapshot.loadDate),
      loadDate: snapshot.loadDate,
      stats: {
        added: snapshot.addedCount,
        changed: snapshot.changedCount,
        removed: snapshot.removedCount,
      },
    });
  }

  return items;
}

export async function listChangeDates(): Promise<DatasetChangeDateItem[]> {
  const rows = await db
    .select({
      loadDate: datasetSnapshots.loadDate,
      snapshotId: datasetSnapshots.id,
      hasDiff: datasetSnapshots.hasDiff,
    })
    .from(datasetSnapshots)
    .where(eq(datasetSnapshots.hasFull, true))
    .orderBy(desc(datasetSnapshots.loadDate));

  return rows.map((row) => ({
    loadDate: row.loadDate,
    snapshotId: row.snapshotId,
    hasDiff: row.hasDiff,
  }));
}

export async function listChangeDatesResponse(): Promise<ChangeDatesResponse> {
  return { items: await listChangeDates() };
}

export async function resolveDatasetRef(ref: DatasetRef): Promise<DatasetRef> {
  if (ref.kind === "current") {
    return ref;
  }

  const rows = await db
    .select({ id: datasetSnapshots.id, hasDiff: datasetSnapshots.hasDiff, hasFull: datasetSnapshots.hasFull })
    .from(datasetSnapshots)
    .where(eq(datasetSnapshots.id, ref.snapshotId!))
    .limit(1);

  const snapshot = rows[0];
  if (!snapshot) {
    throw new DatasetNotFoundError(ref.snapshotId!);
  }

  if (ref.kind === "diff" && !snapshot.hasDiff) {
    throw new DatasetNotFoundError(ref.snapshotId!);
  }

  if (ref.kind === "full" && !snapshot.hasFull) {
    throw new DatasetNotFoundError(ref.snapshotId!);
  }

  return ref;
}

export async function resolveSnapshotByAsOf(
  asOf: string
): Promise<{ id: string; loadDate: string } | null> {
  const rows = await db
    .select({
      id: datasetSnapshots.id,
      loadDate: datasetSnapshots.loadDate,
    })
    .from(datasetSnapshots)
    .where(
      and(
        eq(datasetSnapshots.hasFull, true),
        lte(datasetSnapshots.loadDate, asOf)
      )
    )
    .orderBy(desc(datasetSnapshots.loadDate))
    .limit(1);

  return rows[0] ?? null;
}

export async function getSnapshotLoadDate(
  snapshotId: string
): Promise<string | null> {
  const rows = await db
    .select({ loadDate: datasetSnapshots.loadDate })
    .from(datasetSnapshots)
    .where(eq(datasetSnapshots.id, snapshotId))
    .limit(1);
  return rows[0]?.loadDate ?? null;
}

export async function getDatabaseStorageBytes(): Promise<number> {
  const result = await db.execute<{ size: string }>(
    sql`SELECT pg_database_size(current_database())::text AS size`
  );
  const row = result.rows[0];
  return Number(row?.size ?? 0);
}

export function formatDatabaseBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(1)} ГБ`;
  }
  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(0)} МБ`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

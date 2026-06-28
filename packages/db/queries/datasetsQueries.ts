import { desc, eq } from "drizzle-orm";
import { db } from "../index";
import { DatasetNotFoundError } from "@/packages/db/errors/datasetErrors";
import { datasetMeta, datasetSnapshots } from "../schema";
import {
  DATASET_CURRENT_ID,
  formatDatasetLabel,
  type DatasetListItem,
  type DatasetRef,
} from "@/packages/shared/contracts/dataset.schema";
import { mskLoadDateKey } from "@/packages/import/diffSnapshot";

export async function listDatasetItems(): Promise<DatasetListItem[]> {
  const metaRows = await db
    .select()
    .from(datasetMeta)
    .where(eq(datasetMeta.id, 1));
  const meta = metaRows[0];

  const currentLoadDate = meta?.lastSuccessAt
    ? mskLoadDateKey(meta.lastSuccessAt)
    : null;

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

export async function resolveDatasetRef(ref: DatasetRef): Promise<DatasetRef> {
  if (ref.kind === "current") {
    return ref;
  }

  const rows = await db
    .select({ id: datasetSnapshots.id })
    .from(datasetSnapshots)
    .where(eq(datasetSnapshots.id, ref.snapshotId!))
    .limit(1);

  if (rows.length === 0) {
    throw new DatasetNotFoundError(ref.snapshotId!);
  }

  return ref;
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

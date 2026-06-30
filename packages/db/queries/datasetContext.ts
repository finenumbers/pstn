import { and, eq, lte, desc, type SQL } from "drizzle-orm";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import {
  numberRangeDiffs,
  numberRangeFullSnapshots,
  numberRanges,
} from "../schema";
import {
  getCurrentLoadDate,
  resolveDatasetRef,
  resolveSnapshotByAsOf,
} from "./datasetsQueries";
import type { RangeFilterTable } from "./rangeFilterTable";

export type RangeQueryContext = {
  table: RangeFilterTable;
  snapshotId?: string;
  isDiff: boolean;
  isFull: boolean;
};

export const CURRENT_RANGE_CONTEXT: RangeQueryContext = {
  table: numberRanges,
  isDiff: false,
  isFull: false,
};

export async function resolveQueryContext(
  dataset?: DatasetRef,
  asOf?: string | null
): Promise<RangeQueryContext> {
  if (dataset) {
    return resolveRangeQueryContext(dataset, asOf);
  }
  if (asOf) {
    return resolveRangeQueryContext({ kind: "current" }, asOf);
  }
  return CURRENT_RANGE_CONTEXT;
}

export async function resolveRangeQueryContext(
  ref: DatasetRef,
  asOf?: string | null
): Promise<RangeQueryContext> {
  const resolved = await resolveDatasetRef(ref);

  if (resolved.kind === "diff" && resolved.snapshotId) {
    return {
      table: numberRangeDiffs,
      snapshotId: resolved.snapshotId,
      isDiff: true,
      isFull: false,
    };
  }

  if (resolved.kind === "full" && resolved.snapshotId) {
    return {
      table: numberRangeFullSnapshots,
      snapshotId: resolved.snapshotId,
      isDiff: false,
      isFull: true,
    };
  }

  if (asOf) {
    const currentLoadDate = await getCurrentLoadDate();
    if (currentLoadDate && asOf >= currentLoadDate) {
      return CURRENT_RANGE_CONTEXT;
    }

    const snapshot = await resolveSnapshotByAsOf(asOf);
    if (snapshot) {
      return {
        table: numberRangeFullSnapshots,
        snapshotId: snapshot.id,
        isDiff: false,
        isFull: true,
      };
    }
  }

  return CURRENT_RANGE_CONTEXT;
}

export function mergeSnapshotFilter(
  context: RangeQueryContext,
  where: SQL | undefined
): SQL | undefined {
  if (context.isDiff && context.snapshotId) {
    const snapshotFilter = eq(numberRangeDiffs.snapshotId, context.snapshotId);
    return where ? and(where, snapshotFilter) : snapshotFilter;
  }

  if (context.isFull && context.snapshotId) {
    const snapshotFilter = eq(
      numberRangeFullSnapshots.snapshotId,
      context.snapshotId
    );
    return where ? and(where, snapshotFilter) : snapshotFilter;
  }

  return where;
}

export { lte, desc };

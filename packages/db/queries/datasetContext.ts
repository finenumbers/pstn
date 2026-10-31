import { and, eq, type SQL } from "drizzle-orm";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import { numberRangeDiffs, numberRanges } from "../schema";
import { resolveDatasetRef } from "./datasetsQueries";
import type { RangeFilterTable } from "./rangeFilterTable";

export type RangeQueryContext = {
  table: RangeFilterTable;
  snapshotId?: string;
  isDiff: boolean;
};

export const CURRENT_RANGE_CONTEXT: RangeQueryContext = {
  table: numberRanges,
  isDiff: false,
};

export async function resolveQueryContext(
  dataset?: DatasetRef
): Promise<RangeQueryContext> {
  if (dataset) {
    return resolveRangeQueryContext(dataset);
  }
  return CURRENT_RANGE_CONTEXT;
}

export async function resolveRangeQueryContext(
  ref: DatasetRef
): Promise<RangeQueryContext> {
  const resolved = await resolveDatasetRef(ref);

  if (resolved.kind === "diff" && resolved.snapshotId) {
    return {
      table: numberRangeDiffs,
      snapshotId: resolved.snapshotId,
      isDiff: true,
    };
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

  return where;
}

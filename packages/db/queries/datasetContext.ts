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
  if (!context.isDiff || !context.snapshotId) {
    return where;
  }
  const snapshotFilter = eq(numberRangeDiffs.snapshotId, context.snapshotId);
  if (!where) {
    return snapshotFilter;
  }
  return and(where, snapshotFilter);
}

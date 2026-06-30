import type { DiffChangeStatusKey } from "@/lib/diff/diffChangedFields";
import { eq, or, type SQL } from "drizzle-orm";
import { numberRangeDiffs } from "../schema";

const VALID_KEYS = new Set<string>(["added", "changed", "removed"]);

/** SQL predicate: diff row matches a single change-status filter value. */
export function sqlForChangeStatusKey(key: DiffChangeStatusKey): SQL {
  return eq(numberRangeDiffs.changeType, key);
}

export function sqlForChangeStatusKeys(keys: readonly string[]): SQL | undefined {
  const valid = keys.filter((key): key is DiffChangeStatusKey =>
    VALID_KEYS.has(key)
  );
  if (valid.length === 0) return undefined;
  if (valid.length === 1) return sqlForChangeStatusKey(valid[0]!);
  return or(...valid.map((key) => sqlForChangeStatusKey(key)));
}

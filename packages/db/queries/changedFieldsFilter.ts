import type { DiffChangedFieldKey } from "@/lib/diff/diffChangedFields";
import { eq, or, sql, type SQL } from "drizzle-orm";
import { numberRangeDiffs } from "../schema";

/** SQL predicate: diff row matches a single changed-fields filter value. */
export function sqlForChangedFieldKey(key: DiffChangedFieldKey): SQL {
  const d = numberRangeDiffs;
  switch (key) {
    case "operator":
      return sql`${d.changeType} = 'changed' AND ${d.prevOperator} IS DISTINCT FROM ${d.operator}`;
    case "region":
      return sql`${d.changeType} = 'changed' AND ${d.prevRegion} IS DISTINCT FROM ${d.region}`;
    case "garTerritory":
      return sql`${d.changeType} = 'changed' AND ${d.prevGarTerritory} IS DISTINCT FROM ${d.garTerritory}`;
    case "inn":
      return sql`${d.changeType} = 'changed' AND ${d.prevInn} IS DISTINCT FROM ${d.inn}`;
    case "added":
      return eq(d.changeType, "added");
    case "removed":
      return eq(d.changeType, "removed");
  }
}

export function sqlForChangedFieldKeys(keys: readonly string[]): SQL | undefined {
  const valid = keys.filter(
    (key): key is DiffChangedFieldKey =>
      key === "operator" ||
      key === "region" ||
      key === "garTerritory" ||
      key === "inn" ||
      key === "added" ||
      key === "removed"
  );
  if (valid.length === 0) return undefined;
  if (valid.length === 1) return sqlForChangedFieldKey(valid[0]!);
  return or(...valid.map((key) => sqlForChangedFieldKey(key)));
}

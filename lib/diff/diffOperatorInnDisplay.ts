import type { NumberRangeRow } from "@/packages/shared/contracts/filters.schema";

export type DiffOperatorInnDisplay = {
  oldOperator: string | null;
  newOperator: string | null;
  oldInn: string | null;
  newInn: string | null;
};

/** Maps diff row to old/new operator and INN columns (diff view only). */
export function mapDiffOperatorInn(row: NumberRangeRow): DiffOperatorInnDisplay {
  switch (row.changeType) {
    case "added":
      return {
        oldOperator: null,
        newOperator: row.operator,
        oldInn: null,
        newInn: row.inn || null,
      };
    case "removed":
      return {
        oldOperator: row.operator,
        newOperator: null,
        oldInn: row.inn || null,
        newInn: null,
      };
    case "changed":
      return {
        oldOperator: row.prevOperator ?? row.operator,
        newOperator: row.operator,
        oldInn: row.prevInn ?? (row.inn || null),
        newInn: row.inn || null,
      };
    default:
      return {
        oldOperator: row.operator,
        newOperator: row.operator,
        oldInn: row.inn || null,
        newInn: row.inn || null,
      };
  }
}

export function formatDiffDisplayValue(value: string | null | undefined): string {
  return value && value.length > 0 ? value : "—";
}

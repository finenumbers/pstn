import type { NumberRangeRow } from "@/packages/shared/contracts/filters.schema";

export type DiffOperatorInnDisplay = {
  oldOperator: string | null;
  newOperator: string | null;
  oldInn: string | null;
  newInn: string | null;
};

export type DiffRegionGarDisplay = {
  oldRegion: string | null;
  newRegion: string | null;
  oldGarTerritory: string | null;
  newGarTerritory: string | null;
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

/** Maps diff row to old/new region and GAR territory columns (diff view only). */
export function mapDiffRegionGar(row: NumberRangeRow): DiffRegionGarDisplay {
  switch (row.changeType) {
    case "added":
      return {
        oldRegion: null,
        newRegion: row.region || null,
        oldGarTerritory: null,
        newGarTerritory: row.garTerritory || null,
      };
    case "removed":
      return {
        oldRegion: row.region || null,
        newRegion: null,
        oldGarTerritory: row.garTerritory || null,
        newGarTerritory: null,
      };
    case "changed":
      return {
        oldRegion: row.prevRegion ?? (row.region || null),
        newRegion: row.region || null,
        oldGarTerritory: row.prevGarTerritory ?? (row.garTerritory || null),
        newGarTerritory: row.garTerritory || null,
      };
    default:
      return {
        oldRegion: row.region || null,
        newRegion: row.region || null,
        oldGarTerritory: row.garTerritory || null,
        newGarTerritory: row.garTerritory || null,
      };
  }
}

export function formatDiffDisplayValue(value: string | null | undefined): string {
  return value && value.length > 0 ? value : "—";
}

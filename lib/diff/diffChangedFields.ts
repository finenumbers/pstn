import {
  mapDiffOperatorInn,
  mapDiffRegionGar,
  formatDiffDisplayValue,
} from "@/lib/diff/diffOperatorInnDisplay";
import type { NumberRangeRow } from "@/packages/shared/contracts/filters.schema";

/** Metadata field keys that can differ on a changed diff row. */
export const DIFF_METADATA_FIELD_KEYS = [
  "operator",
  "region",
  "garTerritory",
  "inn",
] as const;

export type DiffMetadataFieldKey = (typeof DIFF_METADATA_FIELD_KEYS)[number];

/** Filter / facet keys including row-level change types. */
export const DIFF_CHANGED_FIELD_KEYS = [
  ...DIFF_METADATA_FIELD_KEYS,
  "added",
  "removed",
] as const;

export type DiffChangedFieldKey = (typeof DIFF_CHANGED_FIELD_KEYS)[number];

export const DIFF_CHANGED_FIELD_LABELS: Record<DiffChangedFieldKey, string> = {
  operator: "Оператор связи",
  region: "Регион",
  garTerritory: "Территория ГАР",
  inn: "ИНН",
  added: "Добавлено",
  removed: "Удалено",
};

export type DiffWasStoRow = {
  key: DiffMetadataFieldKey;
  label: string;
  before: string | null;
  after: string | null;
  changed: boolean;
};

function metadataValuesDiffer(
  before: string | null,
  after: string | null
): boolean {
  return (before ?? "") !== (after ?? "");
}

/** Which metadata fields differ on a changed row (Rule B semantics). */
export function computeChangedMetadataFieldKeys(
  row: NumberRangeRow
): DiffMetadataFieldKey[] {
  if (row.changeType !== "changed") return [];

  const op = mapDiffOperatorInn(row);
  const gar = mapDiffRegionGar(row);
  const keys: DiffMetadataFieldKey[] = [];

  if (metadataValuesDiffer(op.oldOperator, op.newOperator)) {
    keys.push("operator");
  }
  if (metadataValuesDiffer(gar.oldRegion, gar.newRegion)) {
    keys.push("region");
  }
  if (metadataValuesDiffer(gar.oldGarTerritory, gar.newGarTerritory)) {
    keys.push("garTerritory");
  }
  if (metadataValuesDiffer(op.oldInn, op.newInn)) {
    keys.push("inn");
  }

  return keys;
}

/** Facet / filter keys applicable to this diff row. */
export function computeChangedFieldKeys(
  row: NumberRangeRow
): DiffChangedFieldKey[] {
  switch (row.changeType) {
    case "added":
      return ["added"];
    case "removed":
      return ["removed"];
    case "changed":
      return computeChangedMetadataFieldKeys(row);
    default:
      return [];
  }
}

/** Short label for the «Изменения» table cell. */
export function formatChangedFieldsLabel(row: NumberRangeRow): string {
  switch (row.changeType) {
    case "added":
      return DIFF_CHANGED_FIELD_LABELS.added;
    case "removed":
      return DIFF_CHANGED_FIELD_LABELS.removed;
    case "changed": {
      const keys = computeChangedMetadataFieldKeys(row);
      if (keys.length === 0) return "—";
      return keys.map((key) => DIFF_CHANGED_FIELD_LABELS[key]).join(", ");
    }
    default:
      return "—";
  }
}

/** Rows for the was/sto detail dialog. */
export function buildWasStoRows(row: NumberRangeRow): DiffWasStoRow[] {
  const op = mapDiffOperatorInn(row);
  const gar = mapDiffRegionGar(row);
  const changedKeys = new Set(computeChangedMetadataFieldKeys(row));

  return DIFF_METADATA_FIELD_KEYS.map((key) => {
    switch (key) {
      case "operator":
        return {
          key,
          label: DIFF_CHANGED_FIELD_LABELS.operator,
          before: op.oldOperator,
          after: op.newOperator,
          changed:
            row.changeType === "changed"
              ? changedKeys.has("operator")
              : row.changeType === "added" || row.changeType === "removed",
        };
      case "region":
        return {
          key,
          label: DIFF_CHANGED_FIELD_LABELS.region,
          before: gar.oldRegion,
          after: gar.newRegion,
          changed:
            row.changeType === "changed"
              ? changedKeys.has("region")
              : row.changeType === "added" || row.changeType === "removed",
        };
      case "garTerritory":
        return {
          key,
          label: DIFF_CHANGED_FIELD_LABELS.garTerritory,
          before: gar.oldGarTerritory,
          after: gar.newGarTerritory,
          changed:
            row.changeType === "changed"
              ? changedKeys.has("garTerritory")
              : row.changeType === "added" || row.changeType === "removed",
        };
      case "inn":
        return {
          key,
          label: DIFF_CHANGED_FIELD_LABELS.inn,
          before: op.oldInn,
          after: op.newInn,
          changed:
            row.changeType === "changed"
              ? changedKeys.has("inn")
              : row.changeType === "added" || row.changeType === "removed",
        };
    }
  });
}

export function formatWasStoCell(value: string | null | undefined): string {
  return formatDiffDisplayValue(value);
}

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

/** Filter / facet keys for the «Изменения» column (metadata fields only). */
export const DIFF_CHANGED_FIELD_KEYS = [...DIFF_METADATA_FIELD_KEYS] as const;

export type DiffChangedFieldKey = (typeof DIFF_CHANGED_FIELD_KEYS)[number];

export const DIFF_CHANGED_FIELD_LABELS: Record<DiffChangedFieldKey, string> = {
  operator: "Оператор связи",
  region: "Регион",
  garTerritory: "Территория ГАР",
  inn: "ИНН",
};

export const DIFF_CHANGE_STATUS_KEYS = [
  "added",
  "changed",
  "removed",
] as const;

export type DiffChangeStatusKey = (typeof DIFF_CHANGE_STATUS_KEYS)[number];

export const DIFF_CHANGE_STATUS_LABELS: Record<DiffChangeStatusKey, string> = {
  added: "Новый ресурс",
  changed: "Изменение ресурса",
  removed: "Удаление ресурса",
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
  if (row.changeType !== "changed") return [];
  return computeChangedMetadataFieldKeys(row);
}

/** Label for the «Статус» table cell. */
export function formatChangeStatusLabel(row: NumberRangeRow): string {
  const changeType = row.changeType;
  if (!changeType) return "—";
  return DIFF_CHANGE_STATUS_LABELS[changeType] ?? "—";
}

/** Short label for the «Изменения» table cell. */
export function formatChangedFieldsLabel(row: NumberRangeRow): string {
  if (row.changeType !== "changed") return "—";

  const keys = computeChangedMetadataFieldKeys(row);
  if (keys.length === 0) return "—";
  return keys.map((key) => DIFF_CHANGED_FIELD_LABELS[key]).join(", ");
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
          changed: changedKeys.has("operator"),
        };
      case "region":
        return {
          key,
          label: DIFF_CHANGED_FIELD_LABELS.region,
          before: gar.oldRegion,
          after: gar.newRegion,
          changed: changedKeys.has("region"),
        };
      case "garTerritory":
        return {
          key,
          label: DIFF_CHANGED_FIELD_LABELS.garTerritory,
          before: gar.oldGarTerritory,
          after: gar.newGarTerritory,
          changed: changedKeys.has("garTerritory"),
        };
      case "inn":
        return {
          key,
          label: DIFF_CHANGED_FIELD_LABELS.inn,
          before: op.oldInn,
          after: op.newInn,
          changed: changedKeys.has("inn"),
        };
    }
  });
}

export function getWasStoRowHighlightClass(
  changeType: NonNullable<NumberRangeRow["changeType"]>,
  entry: DiffWasStoRow
): string | undefined {
  if (changeType === "changed") {
    return entry.changed ? "bg-yellow-100/80" : undefined;
  }
  if (changeType === "added") {
    return "bg-green-100/80";
  }
  if (changeType === "removed") {
    return "bg-red-100/80";
  }
  return undefined;
}

export function formatWasStoCell(value: string | null | undefined): string {
  return formatDiffDisplayValue(value);
}

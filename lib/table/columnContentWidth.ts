import {
  formatChangeStatusLabel,
  formatChangedFieldsLabel,
} from "@/lib/diff/diffChangedFields";
import { formatNumber, formatRangeSegment } from "@/lib/utils";
import type { NumberRangeRow } from "@/packages/shared/contracts/filters.schema";

const EMPTY = "—";

/** Text actually painted in a body cell. Empty values stay the em dash. */
export function columnDisplayText(
  row: NumberRangeRow,
  columnId: string
): string {
  switch (columnId) {
    case "abc":
      return row.abc;
    case "rangeStart":
      return formatRangeSegment(row.rangeStart);
    case "rangeEnd":
      return formatRangeSegment(row.rangeEnd);
    case "capacity":
      return formatNumber(row.capacity);
    case "operator":
      return row.operator;
    case "garTerritory":
      return row.garTerritory;
    case "legalAddress":
      return row.legalAddress && row.legalAddress.length > 0
        ? row.legalAddress
        : EMPTY;
    case "inn":
      return row.inn && row.inn.length > 0 ? row.inn : EMPTY;
    case "uvrAntifraud":
      return row.uvrAntifraud != null ? String(row.uvrAntifraud) : EMPTY;
    case "changeStatus":
      return formatChangeStatusLabel(row);
    case "changedFields":
      return formatChangedFieldsLabel(row);
    default:
      return "";
  }
}

/**
 * Longest display string per column across the full loaded page, not the
 * virtual window. Character length picks the string; the table measures
 * that one string in IBM Plex after the font loads.
 */
export function longestColumnTexts(
  columnIds: readonly string[],
  headers: Record<string, string>,
  rows: readonly NumberRangeRow[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const columnId of columnIds) {
    let longest = headers[columnId] ?? "";
    for (const row of rows) {
      const text = columnDisplayText(row, columnId);
      if (text.length > longest.length) longest = text;
    }
    out[columnId] = longest;
  }
  return out;
}

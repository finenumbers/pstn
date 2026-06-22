import type { CSSProperties } from "react";
import { formatNumber, formatRangeSegment } from "@/lib/utils";
import type { NumberRangeRow } from "@/packages/shared/contracts/filters.schema";

const COMPACT_COLUMN_HEADERS: Record<string, string> = {
  rangeStart: "Начало",
  rangeEnd: "Конец",
  capacity: "Емкость",
};

const COMPACT_COLUMN_IDS = new Set([
  "abc",
  "rangeStart",
  "rangeEnd",
  "capacity",
]);

/** Button px-3, border, chevron icon */
const FILTER_FIELD_PADDING_CH = 5;
const CHEVRON_CH = 3;
const CLEAR_BUTTON_CH = 2.5;
/** Width scale when ABC filter has selected values (active search mode). */
const ABC_ACTIVE_WIDTH_RATIO = 0.8;

export function isCompactColumn(columnId: string): boolean {
  return COMPACT_COLUMN_IDS.has(columnId);
}

/** Fixed width for the INN column. */
export const INN_COLUMN_WIDTH_CH = 15;

/** Fixed width for the УВр Антифрод column. */
export const UVR_ANTIFRAUD_COLUMN_WIDTH_CH = 18;

/** ABC column: placeholder width; slightly wider when values selected (partial "N выбр…"). */
export function computeAbcFilterColumnWidth(
  selectedCount = 0,
  placeholder = "ABC"
): number {
  const base = placeholder.length + FILTER_FIELD_PADDING_CH + CHEVRON_CH;
  if (selectedCount === 0) {
    return base;
  }
  const digits = String(selectedCount).length;
  const partialLabelCh = digits + 5; // e.g. "3 выбр"
  const activeWidth = base + CLEAR_BUTTON_CH + partialLabelCh;
  return activeWidth * ABC_ACTIVE_WIDTH_RATIO;
}

export function computeCompactColumnWidths(
  data: NumberRangeRow[]
): Record<string, number> {
  const iconPadding = 3;

  const startLengths = data.map((r) => formatRangeSegment(r.rangeStart).length);
  const endLengths = data.map((r) => formatRangeSegment(r.rangeEnd).length);
  const capacityLengths = data.map((r) => formatNumber(r.capacity).length);

  return {
    rangeStart:
      Math.max(COMPACT_COLUMN_HEADERS.rangeStart.length, ...startLengths, 4) +
      iconPadding,
    rangeEnd:
      Math.max(COMPACT_COLUMN_HEADERS.rangeEnd.length, ...endLengths, 4) +
      iconPadding,
    capacity:
      Math.max(
        COMPACT_COLUMN_HEADERS.capacity.length,
        ...capacityLengths,
        4
      ) + iconPadding,
  };
}

export function compactColumnStyle(ch: number): CSSProperties {
  return {
    width: `${ch}ch`,
    minWidth: `${ch}ch`,
    maxWidth: `${ch}ch`,
  };
}

export function columnWidthStyle(ch: number): CSSProperties {
  return {
    width: `${ch}ch`,
    minWidth: `${ch}ch`,
  };
}

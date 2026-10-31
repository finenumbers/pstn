import type { FiltersDTO, NumberRangeRow } from "@/packages/shared/contracts/filters.schema";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import { listRangesForExport } from "@/packages/db/queries/rangesQueries";
import {
  CURRENT_RANGE_CONTEXT,
  resolveRangeQueryContext,
} from "@/packages/db/queries/datasetContext";
import {
  loadUvrLookupMap,
  lookupUvrAntifraud,
} from "@/packages/db/queries/uvrLookupMap";
import { rowToRangesCursor } from "@/lib/api/rangesCursor";
import { effectiveAbcRangeGapMarkers } from "@/lib/table/abcRangeGapDisplay";
import {
  getRangeRowHighlight,
  RANGE_ROW_HIGHLIGHT_ARGB,
  type RangeRowHighlightKind,
} from "@/lib/table/rangeRowHighlight";
import { sanitizeSpreadsheetCell } from "@/lib/export/sanitizeSpreadsheetCell";
import { EXCEL_SHEET_MAX_DATA_ROWS } from "@/lib/export/exportLimits";
import {
  formatDiffDisplayValue,
  mapDiffOperatorInn,
  mapDiffGar,
} from "@/lib/diff/diffOperatorInnDisplay";
import ExcelJS from "exceljs";
import { PassThrough } from "node:stream";
import { Readable } from "node:stream";
import type { Writable } from "node:stream";

export const EXPORT_BATCH_SIZE = 10_000;

const FONT: Partial<ExcelJS.Font> = { name: "Calibri", size: 11 };
const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: "Calibri",
  size: 11,
  bold: true,
};
const COL_WIDTH_CAP = 80;
const COL_WIDTH_PAD = 2;

const THIN_BORDER: Partial<ExcelJS.Border> = { style: "thin" };
const GAP_BORDER: Partial<ExcelJS.Border> = {
  style: "medium",
  color: { argb: "FFEF4444" },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF3F4F6" },
};

export const EXPORT_XLS_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: "ABC", key: "abc", width: 6 },
  { header: "Начало", key: "rangeStart", width: 12 },
  { header: "Конец", key: "rangeEnd", width: 12 },
  { header: "Емкость", key: "capacity", width: 10 },
  { header: "Оператор связи", key: "operator", width: 36 },
  { header: "Территория ГАР", key: "garTerritory", width: 36 },
  { header: "УВр Антифрод", key: "uvrAntifraud", width: 18 },
  { header: "ИНН", key: "inn", width: 15 },
];

export const EXPORT_DIFF_XLS_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: "Тип изменения", key: "changeType", width: 14 },
  { header: "ABC", key: "abc", width: 6 },
  { header: "Начало", key: "rangeStart", width: 12 },
  { header: "Конец", key: "rangeEnd", width: 12 },
  { header: "Емкость", key: "capacity", width: 10 },
  { header: "Старый оператор связи", key: "prevOperator", width: 36 },
  { header: "Новый оператор связи", key: "newOperator", width: 36 },
  { header: "Старая территория ГАР", key: "prevGarTerritory", width: 36 },
  { header: "Новая территория ГАР", key: "newGarTerritory", width: 36 },
  { header: "УВр Антифрод", key: "uvrAntifraud", width: 18 },
  { header: "Старый ИНН", key: "prevInn", width: 15 },
  { header: "Новый ИНН", key: "newInn", width: 15 },
];

export function rowCellBorders(
  gapBefore: boolean,
  gapAfter = false
): Partial<ExcelJS.Borders> {
  return {
    top: gapBefore ? GAP_BORDER : THIN_BORDER,
    left: THIN_BORDER,
    bottom: gapAfter ? GAP_BORDER : THIN_BORDER,
    right: THIN_BORDER,
  };
}

function fillForHighlight(
  kind: RangeRowHighlightKind | null
): ExcelJS.Fill | undefined {
  if (!kind) return undefined;
  return {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: RANGE_ROW_HIGHLIGHT_ARGB[kind] },
  };
}

function displayLength(value: unknown): number {
  if (value == null) return 0;
  return String(value).length;
}

function applyColumnWidths(
  worksheet: ExcelJS.Worksheet,
  maxLens: number[],
  columnCount: number
) {
  for (let i = 0; i < columnCount; i++) {
    const width = Math.min(
      COL_WIDTH_CAP,
      Math.max(8, (maxLens[i] ?? 0) + COL_WIDTH_PAD)
    );
    const col = worksheet.getColumn(i + 1);
    col.width = width;
  }
}

function colLetter(index1Based: number): string {
  let n = index1Based;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  added: "Добавлено",
  changed: "Изменено",
  removed: "Удалено",
};

type ExportDbRow = Awaited<ReturnType<typeof listRangesForExport>>[number];

function toNumberRangeRow(
  row: ExportDbRow,
  uvrAntifraud: number | null
): NumberRangeRow {
  return {
    id: row.id,
    abc: row.abc,
    rangeStart: row.rangeStart,
    rangeEnd: row.rangeEnd,
    capacity: row.capacity,
    operator: row.operator,
    garTerritory: row.garTerritory,
    inn: row.inn,
    uvrAntifraud,
    abcRangeGapBefore: Boolean(row.abcRangeGapBefore),
    abcRangeGapAfter: Boolean(row.abcRangeGapAfter),
    changeType: row.changeType as NumberRangeRow["changeType"],
    prevOperator: row.prevOperator,
    prevInn: row.prevInn,
    prevGarTerritory: row.prevGarTerritory,
  };
}

export type WriteRangesXlsxOptions = {
  filters: FiltersDTO;
  totalRows: number;
  dataset?: DatasetRef;
  signal?: AbortSignal;
  onProgress?: (rowsWritten: number) => void | Promise<void>;
  /** Destination stream (PassThrough for HTTP, file stream for jobs). */
  stream: Writable;
};

export async function writeRangesXlsxToStream(
  options: WriteRangesXlsxOptions
): Promise<{ rowsWritten: number; durationMs: number }> {
  const startMs = Date.now();
  const { filters, dataset, signal, onProgress, stream } = options;
  const isDiff = dataset?.kind === "diff";
  const columns: Partial<ExcelJS.Column>[] = isDiff
    ? EXPORT_DIFF_XLS_COLUMNS
    : EXPORT_XLS_COLUMNS;
  const columnCount = columns.length;
  const keys = columns.map((c) => String(c.key ?? ""));

  const context = dataset
    ? await resolveRangeQueryContext(dataset)
    : CURRENT_RANGE_CONTEXT;

  const uvrMap = await loadUvrLookupMap();

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream,
    useStyles: true,
    useSharedStrings: false,
  });

  let sheetIndex = 1;
  let dataRowsOnSheet = 0;
  let rowsWritten = 0;
  let cursor: ReturnType<typeof rowToRangesCursor> | null = null;
  let prevRow: NumberRangeRow | null = null;
  let maxLens = columns.map((c) => displayLength(c.header));
  let worksheet: ExcelJS.Worksheet | null = null;

  const beginSheet = () => {
    const name =
      sheetIndex === 1 ? "Диапазоны" : `Диапазоны ${sheetIndex}`;
    worksheet = workbook.addWorksheet(name);
    worksheet.columns = columns.map(({ key, width }) => ({ key, width }));
    maxLens = columns.map((c) => displayLength(c.header));
    dataRowsOnSheet = 0;

    const headerRow = worksheet.addRow(columns.map((col) => col.header ?? ""));
    headerRow.font = HEADER_FONT;
    headerRow.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: false,
    };
    const headerBorders = rowCellBorders(false, false);
    for (let col = 1; col <= columnCount; col++) {
      const cell = headerRow.getCell(col);
      cell.border = headerBorders;
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: false,
      };
    }
    headerRow.commit();
  };

  const finishSheet = () => {
    if (!worksheet) return;
    applyColumnWidths(worksheet, maxLens, columnCount);
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: dataRowsOnSheet + 1, column: columnCount },
    };
    worksheet.commit();
    worksheet = null;
  };

  beginSheet();

  try {
    while (true) {
      if (signal?.aborted) {
        throw new Error("Export cancelled");
      }

      const batch = await listRangesForExport(
        filters,
        EXPORT_BATCH_SIZE,
        cursor,
        dataset,
        context
      );
      if (batch.length === 0) break;

      for (const row of batch) {
        if (dataRowsOnSheet >= EXCEL_SHEET_MAX_DATA_ROWS) {
          finishSheet();
          sheetIndex += 1;
          beginSheet();
          prevRow = null;
        }

        const uvr = lookupUvrAntifraud(uvrMap, row.inn);
        const numberRow = toNumberRangeRow(row, uvr);
        const { gapBefore, gapAfter } = isDiff
          ? { gapBefore: false, gapAfter: false }
          : effectiveAbcRangeGapMarkers(numberRow, prevRow);
        const highlight = getRangeRowHighlight(numberRow, { isDiff });
        const fill = fillForHighlight(highlight);
        const borders = rowCellBorders(gapBefore, gapAfter);
        const fontColor =
          highlight === "diffAdded" || highlight === "diffRemoved"
            ? { argb: "FFFFFFFF" }
            : undefined;

        const diffDisplay = isDiff ? mapDiffOperatorInn(numberRow) : null;
        const diffGar = isDiff ? mapDiffGar(numberRow) : null;

        const exportRow = isDiff
          ? {
              changeType: CHANGE_TYPE_LABELS[row.changeType ?? ""] ?? "",
              abc: sanitizeSpreadsheetCell(row.abc),
              rangeStart: row.rangeStart,
              rangeEnd: row.rangeEnd,
              capacity: row.capacity,
              prevOperator: sanitizeSpreadsheetCell(
                formatDiffDisplayValue(diffDisplay!.oldOperator)
              ),
              newOperator: sanitizeSpreadsheetCell(
                formatDiffDisplayValue(diffDisplay!.newOperator)
              ),
              prevGarTerritory: sanitizeSpreadsheetCell(
                formatDiffDisplayValue(diffGar!.oldGarTerritory)
              ),
              newGarTerritory: sanitizeSpreadsheetCell(
                formatDiffDisplayValue(diffGar!.newGarTerritory)
              ),
              uvrAntifraud: sanitizeSpreadsheetCell(
                uvr != null ? String(uvr) : ""
              ),
              prevInn: sanitizeSpreadsheetCell(
                formatDiffDisplayValue(diffDisplay!.oldInn)
              ),
              newInn: sanitizeSpreadsheetCell(
                formatDiffDisplayValue(diffDisplay!.newInn)
              ),
            }
          : {
              abc: sanitizeSpreadsheetCell(row.abc),
              rangeStart: row.rangeStart,
              rangeEnd: row.rangeEnd,
              capacity: row.capacity,
              operator: sanitizeSpreadsheetCell(row.operator),
              garTerritory: sanitizeSpreadsheetCell(row.garTerritory),
              inn: sanitizeSpreadsheetCell(row.inn),
              uvrAntifraud: sanitizeSpreadsheetCell(
                uvr != null ? String(uvr) : ""
              ),
            };

        for (let i = 0; i < keys.length; i++) {
          const key = keys[i]!;
          const len = displayLength(
            (exportRow as Record<string, unknown>)[key]
          );
          if (len > (maxLens[i] ?? 0)) maxLens[i] = len;
        }

        const addedRow = worksheet!.addRow(exportRow);
        for (let col = 1; col <= columnCount; col++) {
          const cell = addedRow.getCell(col);
          cell.border = borders;
          cell.font = fontColor ? { ...FONT, color: fontColor } : FONT;
          cell.alignment = { vertical: "middle", wrapText: false };
          if (fill) cell.fill = fill;
        }
        addedRow.commit();

        prevRow = numberRow;
        dataRowsOnSheet += 1;
        rowsWritten += 1;
      }

      if (onProgress) {
        await onProgress(rowsWritten);
      }

      if (batch.length < EXPORT_BATCH_SIZE) break;
      cursor = rowToRangesCursor({
        ...batch[batch.length - 1],
        uvrAntifraud: null,
        changeType:
          (batch[batch.length - 1].changeType as NumberRangeRow["changeType"]) ??
          null,
        abcRangeGapBefore: Boolean(batch[batch.length - 1].abcRangeGapBefore),
        abcRangeGapAfter: Boolean(batch[batch.length - 1].abcRangeGapAfter),
      });
    }

    finishSheet();
    await workbook.commit();
  } catch (error) {
    stream.destroy?.(
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }

  return { rowsWritten, durationMs: Date.now() - startMs };
}

export async function createRangesXlsxExport(
  filters: FiltersDTO,
  totalRows: number,
  dataset?: DatasetRef,
  signal?: AbortSignal
): Promise<{
  body: ReadableStream<Uint8Array>;
  totalRows: number;
}> {
  const passThrough = new PassThrough();

  const writeTask = writeRangesXlsxToStream({
    filters,
    totalRows,
    dataset,
    signal,
    stream: passThrough,
  }).catch((error) => {
    if (!passThrough.destroyed) {
      passThrough.destroy(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  });

  void writeTask;

  return {
    body: Readable.toWeb(passThrough) as ReadableStream<Uint8Array>,
    totalRows,
  };
}

/** Exposed for tests / docs — last column letter for N columns. */
export function exportAutoFilterRange(columnCount: number): string {
  return `A1:${colLetter(columnCount)}1`;
}

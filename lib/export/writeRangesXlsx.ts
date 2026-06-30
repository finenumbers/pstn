import type { FiltersDTO, NumberRangeRow } from "@/packages/shared/contracts/filters.schema";
import type { DatasetRef } from "@/packages/shared/contracts/dataset.schema";
import {
  listRangesForExport,
} from "@/packages/db/queries/rangesQueries";
import { rowToRangesCursor } from "@/lib/api/rangesCursor";
import { effectiveAbcRangeGapMarkers } from "@/lib/table/abcRangeGapDisplay";
import { sanitizeSpreadsheetCell } from "@/lib/export/sanitizeSpreadsheetCell";
import {
  formatDiffDisplayValue,
  mapDiffOperatorInn,
} from "@/lib/diff/diffOperatorInnDisplay";
import ExcelJS from "exceljs";
import { PassThrough } from "node:stream";
import { Readable } from "node:stream";

export const EXPORT_BATCH_SIZE = 5000;

export const EXPORT_XLS_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: "ABC", key: "abc", width: 6 },
  { header: "Начало", key: "rangeStart", width: 12 },
  { header: "Конец", key: "rangeEnd", width: 12 },
  { header: "Емкость", key: "capacity", width: 10 },
  { header: "Оператор связи", key: "operator", width: 36 },
  { header: "Регион", key: "region", width: 28 },
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
  { header: "Регион", key: "region", width: 28 },
  { header: "Территория ГАР", key: "garTerritory", width: 36 },
  { header: "УВр Антифрод", key: "uvrAntifraud", width: 18 },
  { header: "Старый ИНН", key: "prevInn", width: 15 },
  { header: "Новый ИНН", key: "newInn", width: 15 },
];

const THIN_BORDER: Partial<ExcelJS.Border> = { style: "thin" };

const GAP_BORDER: Partial<ExcelJS.Border> = {
  style: "medium",
  color: { argb: "FFEF4444" },
};

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

function applyRowBorders(
  row: ExcelJS.Row,
  columnCount: number,
  gapBefore = false,
  gapAfter = false
) {
  const borders = rowCellBorders(gapBefore, gapAfter);
  for (let col = 1; col <= columnCount; col++) {
    row.getCell(col).border = borders;
  }
}

function exportRowToNumberRangeRow(
  row: Awaited<ReturnType<typeof listRangesForExport>>[number]
): NumberRangeRow {
  return {
    id: row.id,
    abc: row.abc,
    rangeStart: row.rangeStart,
    rangeEnd: row.rangeEnd,
    capacity: row.capacity,
    operator: row.operator,
    garTerritory: row.garTerritory,
    region: row.region,
    inn: row.inn,
    uvrAntifraud: row.uvrAntifraud,
    abcRangeGapBefore: row.abcRangeGapBefore,
    abcRangeGapAfter: row.abcRangeGapAfter,
    changeType: row.changeType as NumberRangeRow["changeType"],
    prevOperator: row.prevOperator,
    prevInn: row.prevInn,
  };
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  added: "Добавлено",
  changed: "Изменено",
  removed: "Удалено",
};

export async function createRangesXlsxExport(
  filters: FiltersDTO,
  totalRows: number,
  dataset?: DatasetRef,
  asOf?: string | null
): Promise<{
  body: ReadableStream<Uint8Array>;
  totalRows: number;
}> {
  const isDiff = dataset?.kind === "diff";
  const columns: Partial<ExcelJS.Column>[] = isDiff
    ? EXPORT_DIFF_XLS_COLUMNS
    : EXPORT_XLS_COLUMNS;
  const passThrough = new PassThrough();
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: passThrough,
    useStyles: true,
    useSharedStrings: false,
  });
  const worksheet = workbook.addWorksheet("Диапазоны");
  worksheet.columns = columns.map(({ key, width }) => ({ key, width }));
  const columnCount = columns.length;

  const writeTask = (async () => {
    const headerRow = worksheet.addRow(
      columns.map((col) => col.header ?? "")
    );
    applyRowBorders(headerRow, columnCount);
    headerRow.commit();

    let cursor: ReturnType<typeof rowToRangesCursor> | null = null;
    let prevRow: NumberRangeRow | null = null;

    while (true) {
      const batch = await listRangesForExport(
        filters,
        EXPORT_BATCH_SIZE,
        cursor,
        dataset,
        asOf
      );
      if (batch.length === 0) break;

      for (const row of batch) {
        const numberRow = exportRowToNumberRangeRow(row);
        const { gapBefore, gapAfter } = isDiff
          ? { gapBefore: false, gapAfter: false }
          : effectiveAbcRangeGapMarkers(numberRow, prevRow);
        const diffDisplay = isDiff ? mapDiffOperatorInn(numberRow) : null;
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
              garTerritory: sanitizeSpreadsheetCell(row.garTerritory),
              region: sanitizeSpreadsheetCell(row.region),
              uvrAntifraud: sanitizeSpreadsheetCell(
                row.uvrAntifraud != null ? String(row.uvrAntifraud) : ""
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
              region: sanitizeSpreadsheetCell(row.region),
              inn: sanitizeSpreadsheetCell(row.inn),
              uvrAntifraud: sanitizeSpreadsheetCell(
                row.uvrAntifraud != null ? String(row.uvrAntifraud) : ""
              ),
            };
        const addedRow = worksheet.addRow(exportRow);
        applyRowBorders(addedRow, columnCount, gapBefore, gapAfter);
        addedRow.commit();
        prevRow = numberRow;
      }

      if (batch.length < EXPORT_BATCH_SIZE) break;
      cursor = rowToRangesCursor({
        ...batch[batch.length - 1],
        changeType:
          (batch[batch.length - 1].changeType as NumberRangeRow["changeType"]) ??
          null,
      });
    }

    await worksheet.commit();
    await workbook.commit();
  })();

  writeTask.catch((error) => {
    passThrough.destroy(error instanceof Error ? error : new Error(String(error)));
  });

  return {
    body: Readable.toWeb(passThrough) as ReadableStream<Uint8Array>,
    totalRows,
  };
}

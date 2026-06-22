import type { FiltersDTO, NumberRangeRow } from "@/packages/shared/contracts/filters.schema";
import {
  listRangesForExport,
} from "@/packages/db/queries/rangesQueries";
import { rowToRangesCursor } from "@/lib/api/rangesCursor";
import { effectiveAbcRangeGapMarkers } from "@/lib/table/abcRangeGapDisplay";
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
  { header: "Населенный пункт", key: "settlement", width: 24 },
  { header: "Регион", key: "region", width: 28 },
  { header: "ИНН", key: "inn", width: 14 },
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
    settlement: row.settlement,
    region: row.region,
    inn: row.inn,
    abcRangeGapBefore: row.abcRangeGapBefore,
    abcRangeGapAfter: row.abcRangeGapAfter,
  };
}

export async function createRangesXlsxExport(
  filters: FiltersDTO,
  totalRows: number
): Promise<{
  body: ReadableStream<Uint8Array>;
  totalRows: number;
}> {
  const passThrough = new PassThrough();
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: passThrough,
    useStyles: true,
    useSharedStrings: false,
  });
  const worksheet = workbook.addWorksheet("Диапазоны");
  worksheet.columns = EXPORT_XLS_COLUMNS.map(({ key, width }) => ({ key, width }));
  const columnCount = EXPORT_XLS_COLUMNS.length;

  const writeTask = (async () => {
    const headerRow = worksheet.addRow(
      EXPORT_XLS_COLUMNS.map((col) => col.header ?? "")
    );
    applyRowBorders(headerRow, columnCount);
    headerRow.commit();

    let cursor: ReturnType<typeof rowToRangesCursor> | null = null;
    let prevRow: NumberRangeRow | null = null;

    while (true) {
      const batch = await listRangesForExport(
        filters,
        EXPORT_BATCH_SIZE,
        cursor
      );
      if (batch.length === 0) break;

      for (const row of batch) {
        const numberRow = exportRowToNumberRangeRow(row);
        const { gapBefore, gapAfter } = effectiveAbcRangeGapMarkers(
          numberRow,
          prevRow
        );
        const exportRow = {
          abc: row.abc,
          rangeStart: row.rangeStart,
          rangeEnd: row.rangeEnd,
          capacity: row.capacity,
          operator: row.operator,
          settlement: row.settlement,
          region: row.region,
          inn: row.inn,
        };
        const addedRow = worksheet.addRow(exportRow);
        applyRowBorders(addedRow, columnCount, gapBefore, gapAfter);
        addedRow.commit();
        prevRow = numberRow;
      }

      if (batch.length < EXPORT_BATCH_SIZE) break;
      cursor = rowToRangesCursor(batch[batch.length - 1]);
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

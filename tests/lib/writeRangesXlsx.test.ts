import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  EXPORT_DIFF_XLS_COLUMNS,
  EXPORT_XLS_COLUMNS,
  legalAddressExportValue,
  rowCellBorders,
  writeRangesXlsxPages,
  type RangesExportInputRow,
} from "@/lib/export/writeRangesXlsx";

describe("writeRangesXlsx", () => {
  it("defines Russian column headers for Excel export", () => {
    const headers = EXPORT_XLS_COLUMNS.map((col) => col.header);
    expect(headers).toEqual([
      "ABC",
      "Начало",
      "Конец",
      "Емкость",
      "Оператор связи",
      "Территория ГАР",
      "Юридический адрес",
      "ИНН",
      "УВр Антифрод",
    ]);
    expect(headers).not.toContain("Регион");
  });

  it("defines diff export columns with old/new operator, GAR and INN", () => {
    const headers = EXPORT_DIFF_XLS_COLUMNS.map((col) => col.header);
    expect(headers).toEqual([
      "Тип изменения",
      "ABC",
      "Начало",
      "Конец",
      "Емкость",
      "Старый оператор связи",
      "Новый оператор связи",
      "Старая территория ГАР",
      "Новая территория ГАР",
      "Юридический адрес",
      "Старый ИНН",
      "Новый ИНН",
      "УВр Антифрод",
    ]);
    expect(headers).not.toContain("Оператор связи");
    expect(headers).not.toContain("ИНН");
  });

  it("uses red top border when marking an ABC range gap", () => {
    const borders = rowCellBorders(true);
    expect(borders.top?.color?.argb).toBe("FFEF4444");
    expect(borders.top?.style).toBe("medium");
  });

  it("writes the legal address as text and neutralizes formula prefixes", () => {
    expect(legalAddressExportValue("109316, г Москва, д 1")).toBe(
      "109316, г Москва, д 1"
    );
    expect(legalAddressExportValue("")).toBe("");
    expect(legalAddressExportValue("=1+1")).toBe("'=1+1");
    expect(legalAddressExportValue("а".repeat(1800))).toBe("а".repeat(1800));
  });
});

function fixtureRow(
  patch: Partial<RangesExportInputRow> & Pick<RangesExportInputRow, "id">
): RangesExportInputRow {
  return {
    abc: "495",
    rangeStart: 888290,
    rangeEnd: 888299,
    capacity: 10,
    operator: "ООО Ростелеком",
    garTerritory: "г Москва",
    inn: "7707049388",
    abcRangeGapBefore: false,
    abcRangeGapAfter: false,
    ...patch,
  };
}

async function* pagesOf(
  rows: readonly RangesExportInputRow[]
): AsyncGenerator<readonly RangesExportInputRow[]> {
  yield rows;
}

async function readWorkbook(
  isDiff: boolean,
  rows: readonly RangesExportInputRow[],
  maps?: {
    uvrByInn?: Map<string, number>;
    addressByInn?: Map<string, string>;
  }
): Promise<ExcelJS.Workbook> {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });

  const { rowsWritten } = await writeRangesXlsxPages({
    isDiff,
    stream,
    pages: pagesOf(rows),
    uvrByInn: maps?.uvrByInn ?? new Map([["7707049388", 42]]),
    addressByInn:
      maps?.addressByInn ??
      new Map([["7707049388", "109316, г Москва, д 1"]]),
  });
  expect(rowsWritten).toBe(rows.length);

  const workbook = new ExcelJS.Workbook();
  const file = await finished;
  await workbook.xlsx.load(file as unknown as Parameters<ExcelJS.Xlsx["load"]>[0]);
  return workbook;
}

function headerMap(sheet: ExcelJS.Worksheet): Record<string, number> {
  const headers: Record<string, number> = {};
  sheet.getRow(1).eachCell((cell, col) => {
    headers[String(cell.value)] = col;
  });
  return headers;
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value == null) return "";
  if (typeof value === "object" && "text" in value) {
    return String(value.text ?? "");
  }
  return String(value);
}

describe("writeRangesXlsxPages", () => {
  it("writes every current column as text or numbers and never a hyperlink", async () => {
    const workbook = await readWorkbook(false, [
      fixtureRow({ id: 1 }),
      fixtureRow({
        id: 2,
        inn: "5406978329",
        rangeStart: 100,
        capacity: 1000,
        operator: "ПАО МТС",
      }),
    ]);
    const sheet = workbook.getWorksheet("Диапазоны");
    expect(sheet).toBeTruthy();
    const headers = headerMap(sheet!);
    expect(Object.keys(headers)).toEqual(
      EXPORT_XLS_COLUMNS.map((col) => col.header)
    );
    expect(sheet!.rowCount).toBe(3);

    const first = sheet!.getRow(2);
    expect(cellText(first.getCell(headers["Начало"]!))).toBe("888290");
    expect(cellText(first.getCell(headers["Емкость"]!))).toBe("10");
    expect(cellText(first.getCell(headers["ИНН"]!))).toBe("7707049388");
    expect(cellText(first.getCell(headers["УВр Антифрод"]!))).toBe("42");
    expect(cellText(first.getCell(headers["Юридический адрес"]!))).toBe(
      "109316, г Москва, д 1"
    );

    const second = sheet!.getRow(3);
    expect(cellText(second.getCell(headers["ИНН"]!))).toBe("5406978329");
    expect(cellText(second.getCell(headers["УВр Антифрод"]!))).toBe("");
    expect(cellText(second.getCell(headers["Юридический адрес"]!))).toBe("");

    sheet!.eachRow((row) => {
      row.eachCell((cell) => {
        expect(cell.hyperlink).toBeUndefined();
        const value = cell.value;
        if (value && typeof value === "object") {
          expect(value).not.toHaveProperty("hyperlink");
        }
      });
    });
  });

  it("writes diff old and new values as text without links", async () => {
    const workbook = await readWorkbook(true, [
      fixtureRow({
        id: 7,
        changeType: "changed",
        operator: "Новый оператор",
        prevOperator: "Старый оператор",
        inn: "7707049388",
        prevInn: "5406978329",
        garTerritory: "Новая территория",
        prevGarTerritory: "Старая территория",
      }),
    ]);
    const sheet = workbook.getWorksheet("Диапазоны");
    expect(sheet).toBeTruthy();
    const headers = headerMap(sheet!);
    expect(Object.keys(headers)).toEqual(
      EXPORT_DIFF_XLS_COLUMNS.map((col) => col.header)
    );
    expect(sheet!.rowCount).toBe(2);

    const row = sheet!.getRow(2);
    expect(cellText(row.getCell(headers["Тип изменения"]!))).toBe("Изменено");
    expect(cellText(row.getCell(headers["Начало"]!))).toBe("888290");
    expect(cellText(row.getCell(headers["Емкость"]!))).toBe("10");
    expect(cellText(row.getCell(headers["Старый ИНН"]!))).toBe("5406978329");
    expect(cellText(row.getCell(headers["Новый ИНН"]!))).toBe("7707049388");
    expect(cellText(row.getCell(headers["УВр Антифрод"]!))).toBe("42");
    expect(cellText(row.getCell(headers["Юридический адрес"]!))).toBe(
      "109316, г Москва, д 1"
    );
    expect(row.getCell(headers["Юридический адрес"]!).hyperlink).toBeUndefined();
  });
});

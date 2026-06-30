import { describe, expect, it } from "vitest";
import {
  EXPORT_DIFF_XLS_COLUMNS,
  EXPORT_XLS_COLUMNS,
  rowCellBorders,
} from "@/lib/export/writeRangesXlsx";

describe("writeRangesXlsx", () => {
  it("defines Russian column headers for Excel export", () => {
    const headers = EXPORT_XLS_COLUMNS.map((col) => col.header);
    expect(headers).toContain("Начало");
    expect(headers).toContain("Оператор связи");
    expect(headers).toContain("Регион");
    expect(headers).toContain("УВр Антифрод");
  });

  it("defines diff export columns with old/new operator and INN", () => {
    const headers = EXPORT_DIFF_XLS_COLUMNS.map((col) => col.header);
    expect(headers).toEqual([
      "Тип изменения",
      "ABC",
      "Начало",
      "Конец",
      "Емкость",
      "Старый оператор связи",
      "Новый оператор связи",
      "Регион",
      "Территория ГАР",
      "УВр Антифрод",
      "Старый ИНН",
      "Новый ИНН",
    ]);
    expect(headers).not.toContain("Оператор связи");
    expect(headers).not.toContain("ИНН");
  });

  it("uses red top border when marking an ABC range gap", () => {
    const borders = rowCellBorders(true);
    expect(borders.top?.color?.argb).toBe("FFEF4444");
    expect(borders.top?.style).toBe("medium");
  });
});

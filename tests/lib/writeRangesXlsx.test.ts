import { describe, expect, it } from "vitest";
import {
  EXPORT_DIFF_XLS_COLUMNS,
  EXPORT_XLS_COLUMNS,
  legalAddressExportValue,
  rowCellBorders,
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

  it("links a legal address to Yandex and keeps plain text when the URL is too long", () => {
    const linked = legalAddressExportValue("109316, г Москва, д 1");
    expect(linked).toEqual({
      text: "109316, г Москва, д 1",
      hyperlink:
        "https://yandex.ru/maps/?text=109316%2C%20%D0%B3%20%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0%2C%20%D0%B4%201",
    });
    expect(legalAddressExportValue("")).toBe("");
    expect(typeof legalAddressExportValue("а".repeat(1800))).toBe("string");
  });
});

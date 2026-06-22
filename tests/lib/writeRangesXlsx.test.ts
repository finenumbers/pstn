import { describe, expect, it } from "vitest";
import { EXPORT_XLS_COLUMNS, rowCellBorders } from "@/lib/export/writeRangesXlsx";

describe("writeRangesXlsx", () => {
  it("defines Russian column headers for Excel export", () => {
    const headers = EXPORT_XLS_COLUMNS.map((col) => col.header);
    expect(headers).toContain("Начало");
    expect(headers).toContain("Оператор связи");
    expect(headers).toContain("Регион");
  });

  it("uses red top border when marking an ABC range gap", () => {
    const borders = rowCellBorders(true);
    expect(borders.top?.color?.argb).toBe("FFEF4444");
    expect(borders.top?.style).toBe("medium");
  });
});

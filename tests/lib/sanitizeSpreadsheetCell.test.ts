import { describe, expect, it } from "vitest";
import { sanitizeSpreadsheetCell } from "@/lib/export/sanitizeSpreadsheetCell";

describe("sanitizeSpreadsheetCell", () => {
  it("passes through plain text and numbers", () => {
    expect(sanitizeSpreadsheetCell("ООО Ростелеком")).toBe("ООО Ростелеком");
    expect(sanitizeSpreadsheetCell(123)).toBe(123);
  });

  it("prefixes formula-like strings with apostrophe", () => {
    expect(sanitizeSpreadsheetCell("=1+1")).toBe("'=1+1");
    expect(sanitizeSpreadsheetCell("+7999")).toBe("'+7999");
    expect(sanitizeSpreadsheetCell("-100")).toBe("'-100");
    expect(sanitizeSpreadsheetCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });
});

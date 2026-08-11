import { describe, expect, it } from "vitest";
import {
  EXPORT_ASYNC_THRESHOLD,
  EXPORT_ROW_WARN_THRESHOLD,
  EXCEL_SHEET_MAX_DATA_ROWS,
} from "@/lib/export/exportLimits";

describe("exportLimits", () => {
  it("keeps soft warn threshold for UI confirm", () => {
    expect(EXPORT_ROW_WARN_THRESHOLD).toBe(100_000);
  });

  it("uses async jobs above threshold", () => {
    expect(EXPORT_ASYNC_THRESHOLD).toBe(25_000);
  });

  it("reserves one row for Excel header on each sheet", () => {
    expect(EXCEL_SHEET_MAX_DATA_ROWS).toBe(1_048_575);
  });
});

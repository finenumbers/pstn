import { describe, expect, it } from "vitest";
import {
  compactColumnStyle,
  tableColumnWidth,
} from "@/lib/table/compactColumns";

describe("table column widths", () => {
  it("keeps the 14px pixel width after the table font becomes 10px", () => {
    expect(tableColumnWidth(15)).toBe("21ch");
    expect(compactColumnStyle(18).width).toBe("25.2ch");
  });
});

import { describe, expect, it } from "vitest";
import { formatRangeSegment } from "@/lib/utils";

describe("formatRangeSegment", () => {
  it("formats 888290 as 088-82-90", () => {
    expect(formatRangeSegment(888290)).toBe("088-82-90");
  });

  it("formats 0 as 000-00-00", () => {
    expect(formatRangeSegment(0)).toBe("000-00-00");
  });

  it("formats 2110000 as 211-00-00", () => {
    expect(formatRangeSegment(2110000)).toBe("211-00-00");
  });
});

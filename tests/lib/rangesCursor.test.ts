import { describe, expect, it } from "vitest";
import {
  decodeRangesCursor,
  encodeRangesCursor,
} from "@/lib/api/rangesCursor";
import type { NumberRangeRow } from "@/packages/shared/contracts/filters.schema";

function sampleRow(id = 4): NumberRangeRow {
  return {
    id,
    abc: "301",
    rangeStart: 2190000,
    rangeEnd: 2190499,
    capacity: 500,
    operator: "АО \"МТТ\"",
    settlement: "Улан-Удэ",
    region: "Республика Бурятия",
    inn: "1234567890",
    abcRangeGapBefore: false,
    abcRangeGapAfter: true,
  };
}

describe("rangesCursor", () => {
  it("round-trips cursor encoding", () => {
    const encoded = encodeRangesCursor(sampleRow());
    const decoded = decodeRangesCursor(encoded);
    expect(decoded?.id).toBe(4);
    expect(decoded?.rangeStart).toBe(2190000);
    expect(decoded?.operator).toBe("АО \"МТТ\"");
  });

  it("returns null for invalid cursor", () => {
    expect(decodeRangesCursor("not-valid")).toBeNull();
  });
});

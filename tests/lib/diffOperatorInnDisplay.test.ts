import {
  formatDiffDisplayValue,
  mapDiffOperatorInn,
} from "@/lib/diff/diffOperatorInnDisplay";
import type { NumberRangeRow } from "@/packages/shared/contracts/filters.schema";
import { describe, expect, it } from "vitest";

function diffRow(
  overrides: Partial<NumberRangeRow> & Pick<NumberRangeRow, "changeType">
): NumberRangeRow {
  return {
    id: 1,
    abc: "800",
    rangeStart: 100,
    rangeEnd: 200,
    capacity: 101,
    operator: "New Op",
    region: "Region",
    garTerritory: "Territory",
    inn: "7700000000",
    uvrAntifraud: null,
    abcRangeGapBefore: false,
    abcRangeGapAfter: false,
    ...overrides,
  };
}

describe("mapDiffOperatorInn", () => {
  it("maps added row to new operator only", () => {
    expect(
      mapDiffOperatorInn(
        diffRow({ changeType: "added", operator: "Op B", inn: "123" })
      )
    ).toEqual({
      oldOperator: null,
      newOperator: "Op B",
      oldInn: null,
      newInn: "123",
    });
  });

  it("maps removed row to old operator only", () => {
    expect(
      mapDiffOperatorInn(
        diffRow({ changeType: "removed", operator: "Op A", inn: "456" })
      )
    ).toEqual({
      oldOperator: "Op A",
      newOperator: null,
      oldInn: "456",
      newInn: null,
    });
  });

  it("maps changed row to prev and current values", () => {
    expect(
      mapDiffOperatorInn(
        diffRow({
          changeType: "changed",
          operator: "Op B",
          inn: "222",
          prevOperator: "Op A",
          prevInn: "111",
        })
      )
    ).toEqual({
      oldOperator: "Op A",
      newOperator: "Op B",
      oldInn: "111",
      newInn: "222",
    });
  });

  it("formats empty values as em dash", () => {
    expect(formatDiffDisplayValue(null)).toBe("—");
    expect(formatDiffDisplayValue("")).toBe("—");
    expect(formatDiffDisplayValue("123")).toBe("123");
  });
});

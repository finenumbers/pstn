import {
  diffRangeDatasets,
  diffRangesForAbc,
  countDiffSegments,
  type RangeRecord,
} from "@/packages/import/rangeDatasetDiff";
import { describe, expect, it } from "vitest";

function range(
  abc: string,
  start: number,
  end: number,
  operator = "Op",
  overrides: Partial<RangeRecord> = {}
): RangeRecord {
  return {
    abc,
    rangeStart: start,
    rangeEnd: end,
    capacity: end - start + 1,
    operator,
    region: "Region",
    garTerritory: "Territory",
    inn: "",
    ...overrides,
  };
}

describe("rangeDatasetDiff", () => {
  it("splits truncated range into changed and removed segments (383/399 example)", () => {
    const oldRanges = [range("383", 3990000, 3999999)];
    const newRanges = [range("383", 3990000, 3998888)];

    const segments = diffRangesForAbc("383", oldRanges, newRanges);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      changeType: "changed",
      abc: "383",
      rangeStart: 3990000,
      rangeEnd: 3998888,
    });
    expect(segments[1]).toMatchObject({
      changeType: "removed",
      abc: "383",
      rangeStart: 3998889,
      rangeEnd: 3999999,
    });
  });

  it("detects added range", () => {
    const segments = diffRangeDatasets([], [range("800", 100, 200)]);
    expect(segments).toEqual([
      expect.objectContaining({
        changeType: "added",
        abc: "800",
        rangeStart: 100,
        rangeEnd: 200,
      }),
    ]);
  });

  it("detects metadata-only change", () => {
    const oldRanges = [range("495", 100, 200, "Old Op")];
    const newRanges = [range("495", 100, 200, "New Op")];
    const segments = diffRangesForAbc("495", oldRanges, newRanges);
    expect(segments).toEqual([
      expect.objectContaining({
        changeType: "changed",
        operator: "New Op",
        prevOperator: "Old Op",
      }),
    ]);
  });

  it("returns empty diff for identical datasets", () => {
    const rows = [range("812", 1, 100)];
    expect(diffRangeDatasets(rows, rows)).toEqual([]);
  });

  it("counts segment types", () => {
    const segments = diffRangeDatasets(
      [range("383", 3990000, 3999999)],
      [range("383", 3990000, 3998888)]
    );
    expect(countDiffSegments(segments)).toEqual({
      added: 0,
      changed: 1,
      removed: 1,
    });
  });

  it("handles many added segments without stack overflow", () => {
    // One segment per unique ABC — exercises appendAll with >65k total segments
    // without O(n²) findCoveringRange cost of a single large ABC bucket.
    const newRanges = Array.from({ length: 70_000 }, (_, index) =>
      range(String(800 + index), 100, 200)
    );

    const segments = diffRangeDatasets([], newRanges);

    expect(segments).toHaveLength(70_000);
    expect(segments.every((segment) => segment.changeType === "added")).toBe(
      true
    );
  });
});

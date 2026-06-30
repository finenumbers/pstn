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
  it("splits truncated range into removed tail only when overlap metadata matches (383/399, rule B)", () => {
    const oldRanges = [range("383", 3990000, 3999999)];
    const newRanges = [range("383", 3990000, 3998888)];

    const segments = diffRangesForAbc("383", oldRanges, newRanges);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
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
      changed: 0,
      removed: 1,
    });
  });

  it("operator handoff and removal without spurious tail changed row (rule B)", () => {
    const oldRanges = [range("800", 1000, 10999, "Op A", { inn: "111" })];
    const newRanges = [
      range("800", 1000, 4999, "Op A", { inn: "111" }),
      range("800", 5000, 5099, "Op B", { inn: "222" }),
      range("800", 5500, 10999, "Op A", { inn: "111" }),
    ];

    const segments = diffRangesForAbc("800", oldRanges, newRanges);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      changeType: "changed",
      rangeStart: 5000,
      rangeEnd: 5099,
      operator: "Op B",
      prevOperator: "Op A",
      inn: "222",
      prevInn: "111",
    });
    expect(segments[1]).toMatchObject({
      changeType: "removed",
      rangeStart: 5100,
      rangeEnd: 5499,
      operator: "Op A",
    });
  });

  it("splits operator handoff at range boundaries", () => {
    const oldRanges = [
      range("495", 100, 300, "Op A"),
      range("495", 301, 500, "Op B"),
    ];
    const newRanges = [range("495", 100, 500, "Op C")];

    const segments = diffRangesForAbc("495", oldRanges, newRanges);

    expect(segments).toHaveLength(2);
    expect(segments.every((segment) => segment.changeType === "changed")).toBe(
      true
    );
    expect(segments[0]).toMatchObject({
      rangeStart: 100,
      rangeEnd: 300,
      operator: "Op C",
      prevOperator: "Op A",
    });
    expect(segments[1]).toMatchObject({
      rangeStart: 301,
      rangeEnd: 500,
      operator: "Op C",
      prevOperator: "Op B",
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

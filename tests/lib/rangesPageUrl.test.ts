import { describe, expect, it } from "vitest";
import {
  buildRangesPageSearchParams,
  parseDatasetFromSearchParams,
  parseRangesTableFromSearchParams,
} from "@/lib/url/rangesPageUrl";
import { DEFAULT_FILTERS } from "@/packages/shared/contracts/filters.schema";

describe("rangesPageUrl", () => {
  it("round-trips filters and sort in query string", () => {
    const params = new URLSearchParams();
    params.set("filters.operator", "ПАО \"Ростелеком\"");
    params.set("sort", "abc:asc");

    const state = parseRangesTableFromSearchParams(params);
    expect(state?.filters.operator).toEqual(["ПАО \"Ростелеком\""]);
    expect(state?.sorting).toEqual([
      { id: "abc", desc: false },
      { id: "rangeStart", desc: false },
    ]);

    const rebuilt = buildRangesPageSearchParams(
      state!.filters,
      state!.sorting
    );
    expect(rebuilt.get("filters.operator")).toBe("ПАО \"Ростелеком\"");
    expect(rebuilt.get("sort")).toBeNull();
  });

  it("returns null when URL has no table state", () => {
    expect(parseRangesTableFromSearchParams(new URLSearchParams())).toBeNull();
    expect(
      parseRangesTableFromSearchParams(
        buildRangesPageSearchParams(DEFAULT_FILTERS, [
          { id: "abc", desc: false },
          { id: "rangeStart", desc: false },
        ])
      )
    ).toBeNull();
  });

  it("round-trips dataset query param", () => {
    const snapshotId = "550e8400-e29b-41d4-a716-446655440000";
    const params = buildRangesPageSearchParams(
      DEFAULT_FILTERS,
      [{ id: "abc", desc: false }, { id: "rangeStart", desc: false }],
      { kind: "diff", snapshotId }
    );

    expect(params.get("dataset")).toBe(`diff:${snapshotId}`);
    expect(parseDatasetFromSearchParams(params)).toEqual({
      kind: "diff",
      snapshotId,
    });
  });

  it("falls back to current for invalid dataset param", () => {
    const params = new URLSearchParams({ dataset: "diff:not-a-uuid" });
    expect(parseDatasetFromSearchParams(params)).toEqual({ kind: "current" });
  });
});

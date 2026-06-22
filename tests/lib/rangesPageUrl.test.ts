import { describe, expect, it } from "vitest";
import {
  buildRangesPageSearchParams,
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
});

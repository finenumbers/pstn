import { describe, expect, it } from "vitest";
import { DICT_FACET_CONFIG } from "@/packages/db/queries/facetRangesFromDict";

describe("facetRangesFromDict", () => {
  it("maps all facet columns to dictionary tables", () => {
    expect(Object.keys(DICT_FACET_CONFIG)).toEqual([
      "abc",
      "operator",
      "settlement",
      "region",
    ]);
  });
});

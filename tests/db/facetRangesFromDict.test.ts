import { describe, expect, it } from "vitest";
import { DICT_FACET_CONFIG } from "@/packages/db/queries/facetRangesFromDict";
import { DICT_FACET_COLUMNS } from "@/packages/shared/contracts/filters.schema";

describe("facetRangesFromDict", () => {
  it("maps dictionary facet columns to dictionary tables", () => {
    expect(Object.keys(DICT_FACET_CONFIG)).toEqual([...DICT_FACET_COLUMNS]);
  });
});

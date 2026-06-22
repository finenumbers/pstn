import { describe, expect, it } from "vitest";
import { buildWhere } from "@/packages/db/queries/buildWhere";
import {
  DEFAULT_FILTERS,
  filtersToSearchParams,
  parseFiltersFromSearchParams,
} from "@/packages/shared/contracts/filters.schema";

describe("parseFiltersFromSearchParams", () => {
  it("preserves empty settlement facet value", () => {
    const params = new URLSearchParams();
    params.set("filters.settlement", "");
    expect(parseFiltersFromSearchParams(params).settlement).toEqual([""]);
  });

  it("preserves empty settlement mixed with other values", () => {
    const params = new URLSearchParams();
    params.set("filters.settlement", "|||Москва");
    expect(parseFiltersFromSearchParams(params).settlement).toEqual([
      "",
      "Москва",
    ]);
  });

  it("clears empty settlement from URL when filter removed", () => {
    const cleared = filtersToSearchParams({
      ...DEFAULT_FILTERS,
      settlement: [],
    });
    expect(cleared.has("filters.settlement")).toBe(false);
  });
});

describe("buildWhere empty settlement", () => {
  it("filters rows with empty settlement", () => {
    const where = buildWhere({ ...DEFAULT_FILTERS, settlement: [""] });
    expect(where).toBeDefined();
  });
});

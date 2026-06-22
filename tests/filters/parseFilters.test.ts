import { describe, expect, it } from "vitest";
import { buildWhere } from "@/packages/db/queries/buildWhere";
import {
  DEFAULT_FILTERS,
  filtersToSearchParams,
  parseFiltersFromSearchParams,
} from "@/packages/shared/contracts/filters.schema";

describe("parseFiltersFromSearchParams", () => {
  it("preserves empty gar_territory facet value", () => {
    const params = new URLSearchParams();
    params.set("filters.garTerritory", "");
    expect(parseFiltersFromSearchParams(params).garTerritory).toEqual([""]);
  });

  it("preserves empty gar_territory mixed with other values", () => {
    const params = new URLSearchParams();
    params.set("filters.garTerritory", "|||Москва");
    expect(parseFiltersFromSearchParams(params).garTerritory).toEqual([
      "",
      "Москва",
    ]);
  });

  it("clears empty gar_territory from URL when filter removed", () => {
    const cleared = filtersToSearchParams({
      ...DEFAULT_FILTERS,
      garTerritory: [],
    });
    expect(cleared.has("filters.garTerritory")).toBe(false);
  });
});

describe("buildWhere garTerritory", () => {
  it("builds condition for garTerritory filter", () => {
    const where = buildWhere({ ...DEFAULT_FILTERS, garTerritory: [""] });
    expect(where).toBeDefined();
  });
});

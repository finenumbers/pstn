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

  it("ignores a legacy region filter in the URL", () => {
    const params = new URLSearchParams();
    params.set("filters.region", "Москва");
    const filters = parseFiltersFromSearchParams(params);
    expect(filters).not.toHaveProperty("region");
    expect(filters.garTerritory).toEqual([]);
  });

  it("round-trips changedFields filter in URL", () => {
    const params = new URLSearchParams();
    params.set("filters.changedFields", "operator|||inn");
    expect(parseFiltersFromSearchParams(params).changedFields).toEqual([
      "inn",
      "operator",
    ]);
    const serialized = filtersToSearchParams({
      ...DEFAULT_FILTERS,
      changedFields: ["operator", "inn"],
    });
    expect(serialized.get("filters.changedFields")).toBe("operator|||inn");
  });

  it("round-trips changeStatus filter in URL", () => {
    const params = new URLSearchParams();
    params.set("filters.changeStatus", "added|||removed");
    expect(parseFiltersFromSearchParams(params).changeStatus).toEqual([
      "added",
      "removed",
    ]);
    const serialized = filtersToSearchParams({
      ...DEFAULT_FILTERS,
      changeStatus: ["added", "removed"],
    });
    expect(serialized.get("filters.changeStatus")).toBe("added|||removed");
  });

  it("migrates legacy added/removed from changedFields into changeStatus", () => {
    const params = new URLSearchParams();
    params.set("filters.changedFields", "inn|||added");
    expect(parseFiltersFromSearchParams(params)).toMatchObject({
      changedFields: ["inn"],
      changeStatus: ["added"],
    });
  });
});

describe("buildWhere garTerritory", () => {
  it("builds condition for garTerritory filter", () => {
    const where = buildWhere({ ...DEFAULT_FILTERS, garTerritory: [""] });
    expect(where).toBeDefined();
  });
});

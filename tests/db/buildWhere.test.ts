import { describe, expect, it } from "vitest";
import { buildWhere } from "@/packages/db/queries/buildWhere";
import { DEFAULT_FILTERS } from "@/packages/shared/contracts/filters.schema";

describe("buildWhere", () => {
  it("returns undefined when no filters", () => {
    expect(buildWhere(DEFAULT_FILTERS)).toBeUndefined();
  });

  it("includes abc filter when not excluded", () => {
    const where = buildWhere({ ...DEFAULT_FILTERS, abc: ["301"] });
    expect(where).toBeDefined();
  });

  it("includes phone number range overlap filter", () => {
    const where = buildWhere({
      ...DEFAULT_FILTERS,
      phoneNumber: "7777777",
    });
    expect(where).toBeDefined();
  });

  it("includes uvr antifraud filter", () => {
    const where = buildWhere({ ...DEFAULT_FILTERS, uvrAntifraud: ["11012"] });
    expect(where).toBeDefined();
  });

  it("excludes self column from facet query", () => {
    const filters = {
      ...DEFAULT_FILTERS,
      abc: ["301"],
      operator: ["ПАО \"Ростелеком\""],
    };
    const withOperator = buildWhere(filters);
    const excludeOperator = buildWhere(filters, "operator");
    expect(withOperator).toBeDefined();
    expect(excludeOperator).toBeDefined();
  });

  it("builds distinct where for multi-select ABC", () => {
    const single = buildWhere({ ...DEFAULT_FILTERS, abc: ["301"] });
    const multi = buildWhere({ ...DEFAULT_FILTERS, abc: ["301", "353"] });
    expect(single).toBeDefined();
    expect(multi).toBeDefined();
    expect(multi).not.toEqual(single);
  });
});

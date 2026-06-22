import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  FILTER_LIMITS,
  filtersSchema,
  parseFiltersFromSearchParams,
} from "@/packages/shared/contracts/filters.schema";

describe("filter URL bounds", () => {
  it("rejects oversized coverage AND arrays via schema", () => {
    const tooMany = Array.from(
      { length: FILTER_LIMITS.maxCoverageArrayLength + 1 },
      () => "301"
    );
    const parsed = filtersSchema.safeParse({ ...DEFAULT_FILTERS, abc: tooMany });
    expect(parsed.success).toBe(false);
  });

  it("allows or-multi arrays up to maxArrayLength", () => {
    const maxInn = Array.from({ length: FILTER_LIMITS.maxArrayLength }, () =>
      "7707049388"
    );
    const parsed = filtersSchema.safeParse({ ...DEFAULT_FILTERS, inn: maxInn });
    expect(parsed.success).toBe(true);
  });

  it("clamps oversized URL params when parsing search params", () => {
    const params = new URLSearchParams();
    params.set(
      "filters.abc",
      Array.from(
        { length: FILTER_LIMITS.maxCoverageArrayLength + 5 },
        () => "301"
      ).join("|||")
    );
    params.set(
      "filters.inn",
      Array.from({ length: FILTER_LIMITS.maxArrayLength + 5 }, () => "7707049388").join(
        "|||"
      )
    );
    params.set("filters.rangeStart", "x".repeat(FILTER_LIMITS.maxTextFilterLength + 20));

    const filters = parseFiltersFromSearchParams(params);
    expect(filters.abc).toHaveLength(FILTER_LIMITS.maxCoverageArrayLength);
    expect(filters.inn).toHaveLength(FILTER_LIMITS.maxArrayLength);
    expect(filters.rangeStart).toHaveLength(FILTER_LIMITS.maxTextFilterLength);
  });
});

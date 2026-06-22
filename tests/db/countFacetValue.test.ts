import { describe, expect, it } from "vitest";
import { countFacetValue } from "@/packages/db/queries/countFacetValue";
import { DEFAULT_FILTERS } from "@/packages/shared/contracts/filters.schema";

const GUP_OPERATOR = 'ГУП "БАЙКОНУРСВЯЗЬИНФОРМ"';

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("countFacetValue", () => {
  it("returns real row count for selected operator outside top-200 list", async () => {
    const count = await countFacetValue("operator", GUP_OPERATOR, {
      ...DEFAULT_FILTERS,
      operator: [GUP_OPERATOR],
    });
    expect(count).toBeGreaterThan(0);
  });
});

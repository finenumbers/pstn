import { describe, expect, it } from "vitest";
import {
  LOOKUP_SEARCH_PAGE_SIZE_MAX,
  lookupSearchQuerySchema,
  parseLookupSearchQuery,
} from "@/packages/shared/contracts/lookup.schema";

describe("lookupSearchQuerySchema", () => {
  it("accepts mask with X wildcards", () => {
    const parsed = parseLookupSearchQuery({
      phone: "499X66XXXX",
      page: 1,
      pageSize: 50,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.normalized).toBe("499_66____");
      expect(parsed.data.display).toBe("499X66XXXX");
    }
  });

  it("accepts underscore wildcards", () => {
    const parsed = parseLookupSearchQuery({
      phone: "499_66____",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty mask", () => {
    const parsed = parseLookupSearchQuery({
      phone: "XXXXXXXXXX",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects pageSize above max", () => {
    const parsed = lookupSearchQuerySchema.safeParse({
      phone: "499X66XXXX",
      pageSize: LOOKUP_SEARCH_PAGE_SIZE_MAX + 1,
    });
    expect(parsed.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  LOOKUP_SEARCH_PAGE_SIZE_MAX,
  lookupByInnQuerySchema,
  parseLookupByInnQuery,
} from "@/packages/shared/contracts/lookup.schema";

describe("lookupByInnQuerySchema", () => {
  it("accepts 10-digit INN", () => {
    const parsed = parseLookupByInnQuery({
      inn: "5406978329",
      page: 1,
      pageSize: 50,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.inn).toBe("5406978329");
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.pageSize).toBe(50);
    }
  });

  it("accepts 12-digit INN", () => {
    const parsed = parseLookupByInnQuery({
      inn: "123456789012",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.inn).toBe("123456789012");
    }
  });

  it("normalizes non-digit characters", () => {
    const parsed = parseLookupByInnQuery({
      inn: "5406-978-329",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.inn).toBe("5406978329");
    }
  });

  it("rejects empty INN", () => {
    const parsed = parseLookupByInnQuery({
      inn: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects INN with wrong digit length", () => {
    expect(parseLookupByInnQuery({ inn: "12345" }).success).toBe(false);
    expect(parseLookupByInnQuery({ inn: "12345678901" }).success).toBe(false);
    expect(parseLookupByInnQuery({ inn: "abc" }).success).toBe(false);
  });

  it("rejects pageSize above max", () => {
    const parsed = lookupByInnQuerySchema.safeParse({
      inn: "5406978329",
      pageSize: LOOKUP_SEARCH_PAGE_SIZE_MAX + 1,
    });
    expect(parsed.success).toBe(false);
  });
});

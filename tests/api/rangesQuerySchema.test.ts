import { describe, expect, it } from "vitest";
import { rangesQuerySchema } from "@/packages/shared/contracts/filters.schema";

describe("rangesQuerySchema pageSize", () => {
  it("accepts the export page size of 500", () => {
    const parsed = rangesQuerySchema.safeParse({ pageSize: 500 });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.pageSize).toBe(500);
  });

  it("rejects a page size above 500", () => {
    expect(rangesQuerySchema.safeParse({ pageSize: 501 }).success).toBe(false);
  });
});

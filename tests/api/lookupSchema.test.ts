import { describe, expect, it } from "vitest";
import { lookupQuerySchema } from "@/packages/shared/contracts/lookup.schema";

describe("lookupQuerySchema", () => {
  it("accepts exactly 10 digits", () => {
    expect(lookupQuerySchema.safeParse({ phone: "8175421234" }).success).toBe(
      true
    );
  });

  it("rejects too short or non-digit values", () => {
    expect(lookupQuerySchema.safeParse({ phone: "817542123" }).success).toBe(
      false
    );
    expect(lookupQuerySchema.safeParse({ phone: "81754212345" }).success).toBe(
      false
    );
    expect(lookupQuerySchema.safeParse({ phone: "81754212ab" }).success).toBe(
      false
    );
  });
});

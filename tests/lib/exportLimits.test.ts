import { describe, expect, it } from "vitest";
import { EXPORT_ROW_WARN_THRESHOLD } from "@/lib/export/exportLimits";

describe("exportLimits", () => {
  it("warns in UI above 100k rows", () => {
    expect(EXPORT_ROW_WARN_THRESHOLD).toBe(100_000);
  });
});

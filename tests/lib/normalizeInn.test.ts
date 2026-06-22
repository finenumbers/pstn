import { describe, expect, it } from "vitest";
import { normalizeInn } from "@/lib/inn/normalizeInn";

describe("normalizeInn", () => {
  it("keeps digits only", () => {
    expect(normalizeInn("7707049388")).toBe("7707049388");
    expect(normalizeInn(" 7707049388 ")).toBe("7707049388");
    expect(normalizeInn("7707049388/7707")).toBe("77070493887707");
  });
});

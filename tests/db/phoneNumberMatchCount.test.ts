import { describe, expect, it } from "vitest";
import { parsePhoneNumberMask } from "@/lib/phoneNumberMask";
import {
  phoneNumberOverlapSql,
  phoneNumberPartialMatchCountExpr,
} from "@/packages/db/queries/phoneNumberMatchCount";
import { countMatchingNumbersInRange } from "@/lib/phoneNumberMask";

describe("phoneNumberMatchCount SQL", () => {
  it("uses simple overlap SQL for a fully specified subscriber number", () => {
    const parts = parsePhoneNumberMask("___7777373")!;
    const overlap = phoneNumberOverlapSql(parts);
    expect(JSON.stringify(overlap)).toContain("7777373");
    expect(JSON.stringify(overlap)).not.toContain("CASE");
  });

  it("builds partial-mask overlap without stack overflow", () => {
    const parts = parsePhoneNumberMask("777777")!;
    expect(() => phoneNumberOverlapSql(parts)).not.toThrow();
  });

  it("builds partial-mask capacity expression without stack overflow", () => {
    const parts = parsePhoneNumberMask("777777")!;
    expect(() => phoneNumberPartialMatchCountExpr(parts)).not.toThrow();
  });

  it("returns zero matches for non-overlapping partial mask in JS", () => {
    const parts = parsePhoneNumberMask("777777")!;
    expect(countMatchingNumbersInRange(2110000, 2129999, parts)).toBe(0);
  });
});

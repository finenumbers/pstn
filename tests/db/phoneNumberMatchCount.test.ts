import { describe, expect, it } from "vitest";
import {
  countMatchingNumbersInRange,
  parsePhoneNumberMask,
} from "@/lib/phoneNumberMask";
import {
  isAllSubscriberDigitsFixed,
  phoneNumberOverlapSql,
  phoneNumberPartialMatchCountExpr,
} from "@/packages/db/queries/phoneNumberMatchCount";

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

  it("adds subscriber bounds before phone_mask_match_count for partial masks", () => {
    const parts = parsePhoneNumberMask("(383) 399-XX-XX")!;
    expect(isAllSubscriberDigitsFixed(parts)).toBe(false);
    expect(() => phoneNumberOverlapSql(parts)).not.toThrow();

    const fullParts = parsePhoneNumberMask("___7777373")!;
    expect(isAllSubscriberDigitsFixed(fullParts)).toBe(true);
    const fullOverlap = phoneNumberOverlapSql(fullParts);
    expect(JSON.stringify(fullOverlap)).toContain(String(fullParts.subscriberMin));
    expect(JSON.stringify(fullOverlap)).not.toContain("phone_mask_match_count");
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

import { describe, expect, it } from "vitest";
import {
  abcMatchesPhoneMask,
  countMatchingNumbersInRange,
  EMPTY_PHONE_SLOT,
  formatPhoneMaskHint,
  normalizePhoneMask,
  parsePhoneNumberMask,
  rangeMatchesPhoneMask,
  serializePhoneMask,
} from "@/lib/phoneNumberMask";

function buildMask(abc: string[], subscriber: string[]): string {
  const slots = Array(10).fill(EMPTY_PHONE_SLOT);
  abc.forEach((digit, index) => {
    if (digit) slots[index] = digit;
  });
  subscriber.forEach((digit, index) => {
    if (digit) slots[3 + index] = digit;
  });
  return serializePhoneMask(slots);
}

describe("parsePhoneNumberMask", () => {
  it("formats hint as (XXX) XXX-XX-XX", () => {
    const mask = buildMask([], ["", "", "", "7", "7", "7", "7"]);
    expect(formatPhoneMaskHint(normalizePhoneMask(mask))).toBe("(XXX) XXX-77-77");
  });

  it("parses subscriber suffix 777777 aligned from the end", () => {
    const parts = parsePhoneNumberMask("777777")!;
    expect(parts.subscriberMin).toBe(777777);
    expect(parts.subscriberMax).toBe(9777777);
  });

  it("parses full subscriber 7777777", () => {
    const parts = parsePhoneNumberMask("7777777")!;
    expect(parts.subscriberMin).toBe(7777777);
    expect(parts.subscriberMax).toBe(7777777);
  });

  it("parses positional ABC ending with 83 and subscriber 3993999", () => {
    const mask = buildMask(["", "8", "3"], ["3", "9", "9", "3", "9", "9", "9"]);
    const parts = parsePhoneNumberMask(mask)!;
    expect(parts.subscriberMin).toBe(3993999);
    expect(parts.subscriberMax).toBe(3993999);
    expect(abcMatchesPhoneMask("983", parts)).toBe(true);
    expect(abcMatchesPhoneMask("301", parts)).toBe(false);
  });
});

describe("countMatchingNumbersInRange", () => {
  it("counts numbers ending in 7 between 100 and 200", () => {
    const mask = buildMask([], ["", "", "", "", "", "", "7"]);
    const parts = parsePhoneNumberMask(mask)!;
    expect(countMatchingNumbersInRange(100, 200, parts)).toBe(10);
  });

  it("counts one number for full subscriber match inside range", () => {
    const parts = parsePhoneNumberMask("7777777")!;
    expect(countMatchingNumbersInRange(7777770, 7777780, parts)).toBe(1);
    expect(countMatchingNumbersInRange(100, 200, parts)).toBe(0);
  });

  it("counts all numbers in range for leading digit 7 only", () => {
    const mask = buildMask([], ["7", "", "", "", "", "", ""]);
    const parts = parsePhoneNumberMask(mask)!;
    expect(countMatchingNumbersInRange(7500000, 7600000, parts)).toBe(100001);
  });

  it("returns 0 when suffix does not overlap range", () => {
    const parts = parsePhoneNumberMask("777777")!;
    expect(countMatchingNumbersInRange(2110000, 2129999, parts)).toBe(0);
    expect(countMatchingNumbersInRange(1700000, 1800000, parts)).toBe(1);
  });
});

describe("rangeMatchesPhoneMask", () => {
  it("matches 777777 only in ranges containing suffix", () => {
    const parts = parsePhoneNumberMask("777777")!;
    expect(rangeMatchesPhoneMask(1700000, 1800000, parts)).toBe(true);
    expect(rangeMatchesPhoneMask(2110000, 2129999, parts)).toBe(false);
  });

  it("matches 7777 in ranges with numbers ending in 7777", () => {
    const mask = buildMask([], ["", "", "", "7", "7", "7", "7"]);
    const parts = parsePhoneNumberMask(mask)!;
    expect(rangeMatchesPhoneMask(2110000, 2129999, parts)).toBe(true);
    expect(rangeMatchesPhoneMask(2110000, 2115000, parts)).toBe(false);
  });
});

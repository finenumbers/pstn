import { describe, expect, it } from "vitest";
import { dadataPartyUrl } from "@/lib/dadata/partyUrl";

describe("dadataPartyUrl", () => {
  it("returns URL for 10-digit legal entity INN", () => {
    expect(dadataPartyUrl("7707083893")).toBe(
      "https://dadata.ru/find/party/7707083893"
    );
  });

  it("returns URL for 12-digit IP INN", () => {
    expect(dadataPartyUrl("504719613900")).toBe(
      "https://dadata.ru/find/party/504719613900"
    );
  });

  it("returns null for empty, invalid length, or non-digits", () => {
    expect(dadataPartyUrl("")).toBeNull();
    expect(dadataPartyUrl("   ")).toBeNull();
    expect(dadataPartyUrl("12345678901")).toBeNull();
    expect(dadataPartyUrl("abc")).toBeNull();
    expect(dadataPartyUrl("77070493881")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { parsePartyAddress } from "@/lib/dadata/parsePartyAddress";

describe("parsePartyAddress", () => {
  it("reads the head-office address as one line", () => {
    expect(
      parsePartyAddress({
        suggestions: [
          {
            data: {
              address: {
                unrestricted_value:
                  "109316,  г Москва,\nр-н Печатники, Волгоградский пр-кт, д 42",
              },
            },
          },
        ],
      })
    ).toEqual({
      kind: "ok",
      address: "109316, г Москва, р-н Печатники, Волгоградский пр-кт, д 42",
    });
  });

  it("marks an empty suggestion list as not found", () => {
    expect(parsePartyAddress({ suggestions: [] })).toEqual({
      kind: "not_found",
    });
    expect(parsePartyAddress(null)).toEqual({ kind: "not_found" });
  });

  it("marks a company without an address", () => {
    expect(
      parsePartyAddress({
        suggestions: [{ data: { address: null } }],
      })
    ).toEqual({ kind: "no_address" });
    expect(
      parsePartyAddress({
        suggestions: [{ data: { address: { unrestricted_value: "  " } } }],
      })
    ).toEqual({ kind: "no_address" });
  });
});

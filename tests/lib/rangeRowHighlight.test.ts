import { describe, expect, it } from "vitest";
import { FRONTIR_NETWORK_INN } from "@/lib/table/highlightedInns";
import {
  getRangeRowHighlight,
  isAbc80Series,
} from "@/lib/table/rangeRowHighlight";

function row(
  partial: Partial<{ abc: string; inn: string; changeType: string | null }>
) {
  return {
    abc: partial.abc ?? "495",
    inn: partial.inn ?? "7707049388",
    changeType: (partial.changeType ?? null) as
      | "added"
      | "changed"
      | "removed"
      | null,
  };
}

describe("getRangeRowHighlight", () => {
  it("marks frontier over abc80 and abc9", () => {
    expect(
      getRangeRowHighlight(row({ abc: "800", inn: FRONTIR_NETWORK_INN }), {
        isDiff: false,
      })
    ).toBe("frontier");
    expect(
      getRangeRowHighlight(row({ abc: "900", inn: FRONTIR_NETWORK_INN }), {
        isDiff: false,
      })
    ).toBe("frontier");
  });

  it("marks abc80 before abc9", () => {
    expect(
      getRangeRowHighlight(row({ abc: "800" }), { isDiff: false })
    ).toBe("abc80");
    expect(isAbc80Series("809")).toBe(true);
    expect(isAbc80Series("810")).toBe(false);
  });

  it("marks nine-series abc", () => {
    expect(
      getRangeRowHighlight(row({ abc: "903" }), { isDiff: false })
    ).toBe("abc9");
  });

  it("uses changeType only in diff mode", () => {
    expect(
      getRangeRowHighlight(
        row({ abc: "800", inn: FRONTIR_NETWORK_INN, changeType: "added" }),
        { isDiff: true }
      )
    ).toBe("diffAdded");
    expect(
      getRangeRowHighlight(row({ changeType: "changed" }), { isDiff: true })
    ).toBe("diffChanged");
    expect(
      getRangeRowHighlight(row({ changeType: "removed" }), { isDiff: true })
    ).toBe("diffRemoved");
  });
});

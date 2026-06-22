import { describe, expect, it } from "vitest";
import { removeArrayFilterValue } from "@/lib/filters/removeArrayFilterValue";

describe("removeArrayFilterValue", () => {
  it("removes empty settlement value", () => {
    expect(removeArrayFilterValue([""], "")).toEqual([]);
  });

  it("removes matching value and keeps others", () => {
    expect(removeArrayFilterValue(["", "Москва"], "")).toEqual(["Москва"]);
    expect(removeArrayFilterValue(["336", "495"], "336")).toEqual(["495"]);
  });
});

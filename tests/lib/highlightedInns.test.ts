import { describe, expect, it } from "vitest";
import {
  FRONTIR_NETWORK_INN,
  isFrontirNetworkInn,
} from "@/lib/table/highlightedInns";

describe("isFrontirNetworkInn", () => {
  it("matches Frontir Network INN", () => {
    expect(isFrontirNetworkInn(FRONTIR_NETWORK_INN)).toBe(true);
    expect(isFrontirNetworkInn(` ${FRONTIR_NETWORK_INN} `)).toBe(true);
  });

  it("rejects other INNs", () => {
    expect(isFrontirNetworkInn("1234567890")).toBe(false);
    expect(isFrontirNetworkInn("")).toBe(false);
  });
});

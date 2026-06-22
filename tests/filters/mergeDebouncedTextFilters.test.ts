import { describe, expect, it } from "vitest";
import { mergeDebouncedTextFilters } from "@/lib/filters/mergeDebouncedTextFilters";
import { DEFAULT_FILTERS } from "@/packages/shared/contracts/filters.schema";

describe("mergeDebouncedTextFilters", () => {
  it("flushes cleared text filters immediately on reset", () => {
    const debounced = {
      rangeStart: "100",
      rangeEnd: "200",
      capacity: "5",
      phoneNumber: "___7777373",
    };

    const merged = mergeDebouncedTextFilters(DEFAULT_FILTERS, debounced);

    expect(merged.phoneNumber).toBe("");
    expect(merged.rangeStart).toBe("");
  });

  it("uses debounced values while text filters are active", () => {
    const filters = {
      ...DEFAULT_FILTERS,
      phoneNumber: "777",
    };
    const debounced = {
      rangeStart: "",
      rangeEnd: "",
      capacity: "",
      phoneNumber: "777777",
    };

    const merged = mergeDebouncedTextFilters(filters, debounced);
    expect(merged.phoneNumber).toBe("777777");
  });
});

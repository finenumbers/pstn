import { describe, expect, it } from "vitest";
import {
  getFirstDatasetLoadDate,
  maskAsOfDisplayDateInput,
  parseAsOfDisplayDate,
  parseDatasetParam,
  serializeDatasetParam,
  tryParseAsOfParam,
  tryParseDatasetParam,
} from "@/packages/shared/contracts/dataset.schema";

describe("dataset.schema", () => {
  it("parses current dataset", () => {
    expect(parseDatasetParam(undefined)).toEqual({ kind: "current" });
    expect(parseDatasetParam("current")).toEqual({ kind: "current" });
  });

  it("parses diff dataset with uuid", () => {
    const snapshotId = "550e8400-e29b-41d4-a716-446655440000";
    expect(parseDatasetParam(`diff:${snapshotId}`)).toEqual({
      kind: "diff",
      snapshotId,
    });
  });

  it("parses full dataset with uuid", () => {
    const snapshotId = "550e8400-e29b-41d4-a716-446655440000";
    expect(parseDatasetParam(`full:${snapshotId}`)).toEqual({
      kind: "full",
      snapshotId,
    });
  });

  it("parses asOf param", () => {
    const parsed = tryParseAsOfParam("2025-06-15");
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toBe("2025-06-15");
    }
  });

  it("masks display date input with dot separators", () => {
    expect(maskAsOfDisplayDateInput("")).toBe("");
    expect(maskAsOfDisplayDateInput("30")).toBe("30");
    expect(maskAsOfDisplayDateInput("3006")).toBe("30.06");
    expect(maskAsOfDisplayDateInput("30062026")).toBe("30.06.2026");
    expect(maskAsOfDisplayDateInput("30.06.2026")).toBe("30.06.2026");
  });

  it("parses display date DD.MM.YYYY to ISO", () => {
    expect(parseAsOfDisplayDate("15.06.2025")).toBe("2025-06-15");
    expect(parseAsOfDisplayDate("5.6.2025")).toBe("2025-06-05");
    expect(parseAsOfDisplayDate("29.02.2024")).toBe("2024-02-29");
  });

  it("rejects invalid or future display dates", () => {
    expect(parseAsOfDisplayDate("")).toBeNull();
    expect(parseAsOfDisplayDate("32.01.2025")).toBeNull();
    expect(parseAsOfDisplayDate("29.02.2023")).toBeNull();
    expect(parseAsOfDisplayDate("not-a-date")).toBeNull();
    expect(parseAsOfDisplayDate("01.01.2099")).toBeNull();
  });

  it("rejects dates before first dataset load", () => {
    expect(
      parseAsOfDisplayDate("01.01.2024", { firstLoadDate: "2024-06-15" })
    ).toBeNull();
    expect(
      parseAsOfDisplayDate("15.06.2024", { firstLoadDate: "2024-06-15" })
    ).toBe("2024-06-15");
  });

  it("finds earliest load date for calendar bounds", () => {
    expect(
      getFirstDatasetLoadDate([
        { loadDate: "2024-06-15" },
        { loadDate: "2025-01-10" },
      ])
    ).toBe("2024-06-15");
    expect(getFirstDatasetLoadDate([])).toBeNull();
  });

  it("rejects invalid diff snapshot id", () => {
    const parsed = tryParseDatasetParam("diff:not-a-uuid");
    expect(parsed.success).toBe(false);
  });

  it("round-trips dataset param serialization", () => {
    const ref = {
      kind: "diff" as const,
      snapshotId: "550e8400-e29b-41d4-a716-446655440000",
    };
    expect(parseDatasetParam(serializeDatasetParam(ref))).toEqual(ref);
  });
});

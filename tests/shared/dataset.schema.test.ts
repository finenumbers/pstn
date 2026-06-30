import { describe, expect, it } from "vitest";
import {
  parseDatasetParam,
  parseAsOfDisplayDate,
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

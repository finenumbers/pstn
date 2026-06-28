import { describe, expect, it } from "vitest";
import {
  parseDatasetParam,
  serializeDatasetParam,
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

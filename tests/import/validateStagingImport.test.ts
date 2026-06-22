import { describe, expect, it } from "vitest";
import type { SourceFileKey } from "@/packages/import/constants";
import {
  SOURCE_FILE_MIN_ROWS,
  validateFullStagingLoad,
} from "@/packages/import/validateStagingImport";

describe("validateFullStagingLoad", () => {
  it("passes when all four files match parsed counts and minimums", () => {
    const staging = new Map<SourceFileKey, number>([
      ["ABC-3xx", 69_054],
      ["ABC-4xx", 286_141],
      ["ABC-8xx", 73_791],
      ["DEF-9xx", 16_993],
    ]);

    expect(() =>
      validateFullStagingLoad(staging, {
        "ABC-3xx": 69_054,
        "ABC-4xx": 286_141,
        "ABC-8xx": 73_791,
        "DEF-9xx": 16_993,
      })
    ).not.toThrow();
  });

  it("fails when any MinDigital file is missing or incomplete", () => {
    const staging = new Map<SourceFileKey, number>([
      ["ABC-4xx", 161_141],
      ["ABC-8xx", 73_791],
      ["DEF-9xx", 16_993],
    ]);

    expect(() =>
      validateFullStagingLoad(staging, {
        "ABC-3xx": 0,
        "ABC-4xx": 161_141,
        "ABC-8xx": 73_791,
        "DEF-9xx": 16_993,
      })
    ).toThrow(/ABC-3xx/);

    expect(() =>
      validateFullStagingLoad(staging, {
        "ABC-3xx": 0,
        "ABC-4xx": 161_141,
        "ABC-8xx": 73_791,
        "DEF-9xx": 16_993,
      })
    ).toThrow(/Full import validation failed/);
  });

  it("fails when staging row count differs from parsed count", () => {
    const staging = new Map<SourceFileKey, number>([
      ["ABC-3xx", 69_000],
      ["ABC-4xx", 286_141],
      ["ABC-8xx", 73_791],
      ["DEF-9xx", 16_993],
    ]);

    expect(() =>
      validateFullStagingLoad(staging, {
        "ABC-3xx": 69_054,
        "ABC-4xx": 286_141,
        "ABC-8xx": 73_791,
        "DEF-9xx": 16_993,
      })
    ).toThrow(/staging 69[\s\u00a0]?000 ≠ parsed 69[\s\u00a0]?054/);
  });

  it("enforces minimum row floor per file", () => {
    expect(SOURCE_FILE_MIN_ROWS["ABC-3xx"]).toBeGreaterThan(60_000);
  });
});

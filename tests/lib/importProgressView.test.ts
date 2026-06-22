import { describe, expect, it } from "vitest";
import {
  buildImportFileProgress,
  buildImportProgressDisplay,
  computeImportPercent,
  resolvePhaseLabel,
} from "@/lib/import/importProgressView";

describe("importProgressView", () => {
  it("treats legacy completed jobs without per-file rows as done", () => {
    const files = buildImportFileProgress(
      "completed",
      {},
      "completed",
      4,
      4
    );

    expect(files.every((file) => file.status === "done")).toBe(true);
  });

  it("marks completed files and current loading file", () => {
    const files = buildImportFileProgress(
      "loading_ABC-8xx",
      {
        "ABC-3xx": 69_054,
        "ABC-4xx": 286_141,
      },
      "running"
    );

    expect(files).toEqual([
      { key: "ABC-3xx", status: "done", rows: 69_054 },
      { key: "ABC-4xx", status: "done", rows: 286_141 },
      { key: "ABC-8xx", status: "loading", rows: null },
      { key: "DEF-9xx", status: "pending", rows: null },
    ]);
  });

  it("marks failed file when import stops during download", () => {
    const files = buildImportFileProgress(
      "loading_ABC-8xx",
      {
        "ABC-3xx": 69_054,
        "ABC-4xx": 286_141,
      },
      "failed"
    );

    expect(files[2]).toEqual({
      key: "ABC-8xx",
      status: "failed",
      rows: null,
    });
  });

  it("builds human-readable phase labels", () => {
    expect(resolvePhaseLabel("loading_ABC-4xx", "running")).toBe(
      "Загрузка ABC-4xx…"
    );
    expect(resolvePhaseLabel("validating", "running")).toBe(
      "Проверка полноты данных…"
    );
    expect(resolvePhaseLabel("completed", "completed")).toBe(
      "Загрузка завершена"
    );
  });

  it("returns 100% only for completed jobs", () => {
    expect(computeImportPercent("swapping", 4, 4, "running")).toBe(96);
    expect(computeImportPercent("completed", 4, 4, "completed")).toBe(100);
  });

  it("builds full progress display payload", () => {
    const display = buildImportProgressDisplay({
      status: "running",
      phase: "loaded_ABC-3xx",
      fileRows: { "ABC-3xx": 69_054 },
      filesProcessed: 1,
      filesTotal: 4,
      rowsLoaded: 69_054,
    });

    expect(display.percent).toBeGreaterThan(5);
    expect(display.files[0].status).toBe("done");
    expect(display.steps[0].status).toBe("active");
  });
});

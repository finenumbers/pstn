import { describe, expect, it } from "vitest";
import { mapImportErrorMessage } from "@/lib/import/mapImportErrorMessage";
import { STALE_IMPORT_JOB_MESSAGE } from "@/packages/import/importJobConstants";

describe("mapImportErrorMessage", () => {
  it("maps stale import message", () => {
    expect(mapImportErrorMessage(STALE_IMPORT_JOB_MESSAGE)).toContain(
      "перезапуска сервера"
    );
  });

  it("maps validation failures", () => {
    expect(
      mapImportErrorMessage(
        "Full import validation failed — all four MinDigital CSV files must be present"
      )
    ).toContain("Минцифры");
  });

  it("maps download failures", () => {
    expect(mapImportErrorMessage("Failed to download https://example.com/a.csv")).toContain(
      "opendata.digital.gov.ru"
    );
  });

  it("keeps already Russian messages", () => {
    expect(mapImportErrorMessage("Ошибка загрузки")).toBe("Ошибка загрузки");
  });

  it("returns null for empty input", () => {
    expect(mapImportErrorMessage(null)).toBeNull();
  });
});

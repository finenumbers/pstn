import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BUNDLED_OPR_FILENAME,
  BUNDLED_OPR_CONTAINER_PATH,
} from "@/packages/import/constants";
import { resolveOprCsvPath } from "@/packages/import/importOprRegister";

describe("resolveOprCsvPath", () => {
  const originalEnv = process.env.OPR_CSV_PATH;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.OPR_CSV_PATH;
    } else {
      process.env.OPR_CSV_PATH = originalEnv;
    }
  });

  it("prefers OPR_CSV_PATH when file exists", () => {
    const devPath = join(process.cwd(), "data", "opr", BUNDLED_OPR_FILENAME);
    process.env.OPR_CSV_PATH = devPath;
    expect(resolveOprCsvPath()).toBe(devPath);
  });

  it("falls back to bundled dev path", () => {
    delete process.env.OPR_CSV_PATH;
    const devPath = join(process.cwd(), "data", "opr", BUNDLED_OPR_FILENAME);
    if (!existsSync(devPath)) {
      expect(resolveOprCsvPath()).toBeNull();
      return;
    }
    expect(resolveOprCsvPath()).toBe(devPath);
  });

  it("uses container path constant in production image", () => {
    expect(BUNDLED_OPR_CONTAINER_PATH).toBe(
      `/app/data/opr/${BUNDLED_OPR_FILENAME}`
    );
  });
});

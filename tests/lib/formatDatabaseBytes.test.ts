import { describe, expect, it } from "vitest";
import { formatDatabaseBytes } from "@/packages/db/queries/datasetsQueries";

describe("formatDatabaseBytes", () => {
  it("formats gigabytes", () => {
    expect(formatDatabaseBytes(2.5 * 1024 ** 3)).toBe("2.5 ГБ");
  });

  it("formats megabytes", () => {
    expect(formatDatabaseBytes(128 * 1024 ** 2)).toBe("128 МБ");
  });
});

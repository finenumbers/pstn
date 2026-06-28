import { describe, expect, it } from "vitest";
import {
  checkImportAuthorization,
  requireImportSecret,
} from "@/lib/api/importAuth";

describe("checkImportAuthorization", () => {
  it("allows requests when IMPORT_SECRET is not configured", () => {
    const previous = process.env.IMPORT_SECRET;
    delete process.env.IMPORT_SECRET;

    const result = checkImportAuthorization(
      new Request("http://localhost/api/import", { method: "POST" })
    );

    expect(result).toBeNull();
    process.env.IMPORT_SECRET = previous;
  });

  it("rejects requests without a matching secret", () => {
    process.env.IMPORT_SECRET = "test-secret";

    const result = checkImportAuthorization(
      new Request("http://localhost/api/import", { method: "POST" })
    );

    expect(result?.status).toBe(401);
  });

  it("allows requests with a matching x-import-secret header", () => {
    process.env.IMPORT_SECRET = "test-secret";

    const result = checkImportAuthorization(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "x-import-secret": "test-secret" },
      })
    );

    expect(result).toBeNull();
  });
});

describe("requireImportSecret", () => {
  it("rejects cron requests when IMPORT_SECRET is not configured", () => {
    const previous = process.env.IMPORT_SECRET;
    delete process.env.IMPORT_SECRET;

    const result = requireImportSecret(
      new Request("http://localhost/api/import", { method: "POST" })
    );

    expect(result?.status).toBe(401);
    process.env.IMPORT_SECRET = previous;
  });

  it("allows cron requests with matching secret", () => {
    process.env.IMPORT_SECRET = "cron-secret";

    const result = requireImportSecret(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "x-import-secret": "cron-secret" },
      })
    );

    expect(result).toBeNull();
  });
});

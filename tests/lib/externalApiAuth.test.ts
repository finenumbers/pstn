import { describe, expect, it } from "vitest";
import {
  checkExternalApiAuthorization,
  isExternalApiConfigured,
} from "@/lib/api/externalApiAuth";

describe("checkExternalApiAuthorization", () => {
  it("returns 503 when EXTERNAL_API_KEY is not configured", () => {
    const previous = process.env.EXTERNAL_API_KEY;
    delete process.env.EXTERNAL_API_KEY;

    const result = checkExternalApiAuthorization(
      new Request("http://localhost/api/v1/lookup?phone=8175421234")
    );

    expect(result?.status).toBe(503);
    expect(isExternalApiConfigured()).toBe(false);
    process.env.EXTERNAL_API_KEY = previous;
  });

  it("rejects requests without a matching key", () => {
    process.env.EXTERNAL_API_KEY = "test-api-key";

    const result = checkExternalApiAuthorization(
      new Request("http://localhost/api/v1/lookup?phone=8175421234")
    );

    expect(result?.status).toBe(401);
  });

  it("allows requests with Authorization Bearer token", () => {
    process.env.EXTERNAL_API_KEY = "test-api-key";

    const result = checkExternalApiAuthorization(
      new Request("http://localhost/api/v1/lookup?phone=8175421234", {
        headers: { Authorization: "Bearer test-api-key" },
      })
    );

    expect(result).toBeNull();
  });

  it("allows requests with x-api-key header", () => {
    process.env.EXTERNAL_API_KEY = "test-api-key";

    const result = checkExternalApiAuthorization(
      new Request("http://localhost/api/v1/lookup?phone=8175421234", {
        headers: { "x-api-key": "test-api-key" },
      })
    );

    expect(result).toBeNull();
  });
});

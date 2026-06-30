import { describe, expect, it } from "vitest";
import { API_ERROR_CODES } from "@/lib/api/apiErrorCodes";
import { mapApiError } from "@/lib/api/mapApiError";
import { parseErrorBody } from "@/lib/api/parseErrorBody";

describe("parseErrorBody", () => {
  it("parses structured error", () => {
    expect(
      parseErrorBody({
        error: {
          code: "VALIDATION_ERROR",
          message: "Тест",
          details: { retryAfterSec: 30 },
        },
      })
    ).toEqual({
      code: "VALIDATION_ERROR",
      message: "Тест",
      retryAfterSec: 30,
    });
  });

  it("parses legacy string error", () => {
    expect(parseErrorBody({ error: "Too many requests" })).toEqual({
      message: "Too many requests",
    });
  });
});

describe("mapApiError", () => {
  it("maps 429 with retry hint", () => {
    const mapped = mapApiError(
      429,
      {
        error: {
          code: API_ERROR_CODES.RATE_LIMITED,
          message: "Слишком много запросов. Повторите через 45 сек.",
          details: { retryAfterSec: 45 },
        },
      },
      "45"
    );
    expect(mapped.code).toBe(API_ERROR_CODES.RATE_LIMITED);
    expect(mapped.userMessage).toContain("45");
    expect(mapped.retryAfterSec).toBe(45);
  });

  it("uses server message when present", () => {
    const mapped = mapApiError(400, {
      error: {
        code: API_ERROR_CODES.EXPORT_TOO_LARGE,
        message: "Слишком много строк для экспорта.",
      },
    });
    expect(mapped.userMessage).toBe("Слишком много строк для экспорта.");
  });

  it("falls back for unknown status", () => {
    const mapped = mapApiError(418, {});
    expect(mapped.userMessage).toContain("418");
  });
});

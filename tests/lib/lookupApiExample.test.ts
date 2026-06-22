import { describe, expect, it } from "vitest";
import {
  buildLookupCurlExample,
  buildLookupCurlExamples,
  buildLookupSearchCurlExample,
  LOOKUP_DEFAULT_MASK,
  LOOKUP_DEFAULT_PHONE,
  maskSearchQueryFromMask,
  phoneQueryFromMask,
  resolveLookupExampleOrigin,
} from "@/lib/api/lookupApiExample";
import {
  formatPhoneMaskForApi,
  normalizePhoneMaskQuery,
  parseLookupSearchPhone,
} from "@/lib/phoneNumberMask";

describe("lookupApiExample", () => {
  it("builds exact lookup curl", () => {
    const curl = buildLookupCurlExample(
      "https://api.pstn.example.com",
      "test-api-key"
    );
    expect(curl).toContain(
      `https://api.pstn.example.com/api/v1/lookup?phone=${LOOKUP_DEFAULT_PHONE}`
    );
    expect(curl).toContain("Bearer test-api-key");
  });

  it("builds search curl with mask and pagination", () => {
    const curl = buildLookupSearchCurlExample(
      "https://api.pstn.example.com",
      "test-api-key"
    );
    expect(curl).toContain("/api/v1/lookup/search?phone=");
    expect(curl).toContain(encodeURIComponent(LOOKUP_DEFAULT_MASK));
    expect(curl).toContain("page=1");
    expect(curl).toContain("pageSize=50");
  });

  it("uses complete phone mask digits in exact example", () => {
    expect(phoneQueryFromMask("3012110000")).toBe("3012110000");
    expect(phoneQueryFromMask("301______")).toBe(LOOKUP_DEFAULT_PHONE);
  });

  it("uses mask from find-number field in search example", () => {
    expect(maskSearchQueryFromMask("499X66XXXX")).toBe("499X66XXXX");
    expect(maskSearchQueryFromMask("499______")).toBe("499XXXXXXX");
    expect(maskSearchQueryFromMask("")).toBe(LOOKUP_DEFAULT_MASK);
  });

  it("builds paired curl examples from phone mask input", () => {
    const { exactCurl, searchCurl } = buildLookupCurlExamples(
      "https://api.pstn.example.com",
      "secret-key-123",
      "3012110000"
    );
    expect(exactCurl).toContain("phone=3012110000");
    expect(exactCurl).toContain("Bearer secret-key-123");
    expect(searchCurl).toContain(encodeURIComponent("3012110000"));
    expect(searchCurl).not.toContain('"apiKey"');
  });

  it("prefers configured base URL over request host", () => {
    const request = new Request("http://localhost:5555/ranges", {
      headers: { host: "localhost:5555" },
    });
    expect(
      resolveLookupExampleOrigin(request, "https://api.pstn.example.com")
    ).toBe("https://api.pstn.example.com");
  });

  it("falls back to forwarded request origin", () => {
    const request = new Request("http://internal/ranges", {
      headers: {
        host: "pstn.example.com",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "pstn.example.com",
      },
    });
    expect(resolveLookupExampleOrigin(request)).toBe("https://pstn.example.com");
  });
});

describe("normalizePhoneMaskQuery", () => {
  it("maps X wildcards to internal mask", () => {
    expect(normalizePhoneMaskQuery("499X66XXXX")).toBe("499_66____");
    expect(parseLookupSearchPhone("499X66XXXX")?.display).toBe("499X66XXXX");
  });

  it("rejects empty masks", () => {
    expect(normalizePhoneMaskQuery("XXXXXXXXXX")).toBeNull();
    expect(normalizePhoneMaskQuery("")).toBeNull();
  });

  it("formats internal mask for API display", () => {
    expect(formatPhoneMaskForApi("499_66____")).toBe("499X66XXXX");
  });
});

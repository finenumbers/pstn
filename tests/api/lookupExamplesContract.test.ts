import { describe, expect, it } from "vitest";

describe("lookup examples API contract", () => {
  it("documents response shape without apiKey field", () => {
    const configuredResponse = {
      configured: true as const,
      baseUrl: "https://api.pstn.example.com",
      exactCurl:
        'curl -s "https://api.pstn.example.com/api/v1/lookup?phone=4996660000" -H "Authorization: Bearer secret"',
      searchCurl:
        'curl -s "https://api.pstn.example.com/api/v1/lookup/search?phone=499X66XXXX&page=1&pageSize=50" -H "Authorization: Bearer secret"',
    };

    expect(configuredResponse).not.toHaveProperty("apiKey");
    expect(Object.keys(configuredResponse).sort()).toEqual([
      "baseUrl",
      "configured",
      "exactCurl",
      "searchCurl",
    ]);
  });
});

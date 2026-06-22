import { afterEach, describe, expect, it } from "vitest";
import { getExternalApiBaseUrl } from "@/lib/api/externalApiBaseUrl";

describe("getExternalApiBaseUrl", () => {
  afterEach(() => {
    delete process.env.EXTERNAL_API_BASE_URL;
  });

  it("returns trimmed URL without trailing slash", () => {
    process.env.EXTERNAL_API_BASE_URL = "https://api.pstn.example.com/";
    expect(getExternalApiBaseUrl()).toBe("https://api.pstn.example.com");
  });

  it("supports IP-based URL", () => {
    process.env.EXTERNAL_API_BASE_URL = "http://203.0.113.5:5555";
    expect(getExternalApiBaseUrl()).toBe("http://203.0.113.5:5555");
  });

  it("returns undefined when env is not set", () => {
    expect(getExternalApiBaseUrl()).toBeUndefined();
  });
});

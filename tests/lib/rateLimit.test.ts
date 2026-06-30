import { describe, expect, it, beforeEach } from "vitest";
import {
  checkRateLimit,
  parseRateLimitEnv,
  resetRateLimitBucketsForTests,
} from "@/lib/api/rateLimit";

describe("parseRateLimitEnv", () => {
  it("parses max/windowMs", () => {
    expect(parseRateLimitEnv("10/60000", { maxRequests: 1, windowMs: 1000 })).toEqual({
      maxRequests: 10,
      windowMs: 60000,
    });
  });

  it("falls back on invalid value", () => {
    const fallback = { maxRequests: 3, windowMs: 1000 };
    expect(parseRateLimitEnv("bad", fallback)).toEqual(fallback);
    expect(parseRateLimitEnv(undefined, fallback)).toEqual(fallback);
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitBucketsForTests();
  });

  it("allows requests within limit", () => {
    const config = { maxRequests: 2, windowMs: 60_000 };
    expect(checkRateLimit("k", config, 1000).allowed).toBe(true);
    expect(checkRateLimit("k", config, 2000).allowed).toBe(true);
    expect(checkRateLimit("k", config, 3000).allowed).toBe(false);
  });

  it("resets window after expiry", () => {
    const config = { maxRequests: 1, windowMs: 10_000 };
    expect(checkRateLimit("k", config, 1000).allowed).toBe(true);
    expect(checkRateLimit("k", config, 2000).allowed).toBe(false);
    expect(checkRateLimit("k", config, 12_000).allowed).toBe(true);
  });

  it("returns retryAfterSec when blocked", () => {
    const config = { maxRequests: 1, windowMs: 10_000 };
    checkRateLimit("k", config, 1000);
    const blocked = checkRateLimit("k", config, 2000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});

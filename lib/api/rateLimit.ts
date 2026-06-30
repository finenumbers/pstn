export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface WindowEntry {
  timestamps: number[];
}

const buckets = new Map<string, WindowEntry>();

/** Parse env like `10/60000` → max requests per windowMs. */
export function parseRateLimitEnv(
  envValue: string | undefined,
  fallback: RateLimitConfig
): RateLimitConfig {
  if (!envValue) return fallback;
  const match = envValue.trim().match(/^(\d+)\/(\d+)$/);
  if (!match) return fallback;
  const maxRequests = Number(match[1]);
  const windowMs = Number(match[2]);
  if (!Number.isFinite(maxRequests) || !Number.isFinite(windowMs)) {
    return fallback;
  }
  if (maxRequests < 1 || windowMs < 1) return fallback;
  return { maxRequests, windowMs };
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
  now = Date.now()
): { allowed: boolean; retryAfterSec: number } {
  let entry = buckets.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    buckets.set(key, entry);
  }

  const cutoff = now - config.windowMs;
  entry.timestamps = entry.timestamps.filter((timestamp) => timestamp > cutoff);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldest = entry.timestamps[0]!;
    const retryAfterMs = Math.max(0, oldest + config.windowMs - now);
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  entry.timestamps.push(now);
  return { allowed: true, retryAfterSec: 0 };
}

export function resetRateLimitBucketsForTests(): void {
  buckets.clear();
}

export const RATE_LIMIT_DEFAULTS = {
  import: { maxRequests: 3, windowMs: 10 * 60 * 1000 },
  export: { maxRequests: 10, windowMs: 60 * 1000 },
  facets: { maxRequests: 60, windowMs: 60 * 1000 },
  lookup: { maxRequests: 120, windowMs: 60 * 1000 },
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMIT_DEFAULTS;

export function resolveRateLimitConfig(bucket: RateLimitBucket): RateLimitConfig {
  const envKeys: Record<RateLimitBucket, string> = {
    import: "RATE_LIMIT_IMPORT",
    export: "RATE_LIMIT_EXPORT",
    facets: "RATE_LIMIT_FACETS",
    lookup: "RATE_LIMIT_LOOKUP",
  };
  return parseRateLimitEnv(process.env[envKeys[bucket]], RATE_LIMIT_DEFAULTS[bucket]);
}

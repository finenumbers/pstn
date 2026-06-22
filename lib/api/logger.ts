import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "pstn-analytics" },
});

export function logApiTiming(
  route: string,
  startMs: number,
  meta: Record<string, unknown>
) {
  const durationMs = Date.now() - startMs;
  if (durationMs > 100) {
    logger.info({ route, durationMs, ...meta }, "slow_api_request");
  }
}

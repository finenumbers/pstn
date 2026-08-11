import { join } from "node:path";

/** Advisory lock key distinct from import (7123456789). */
export const EXPORT_JOB_ADVISORY_LOCK_KEY = 7123456790;

/** Fail jobs with no heartbeat for this long. */
export const STALE_EXPORT_JOB_MS = 45 * 60 * 1000;

/** Delete completed/failed export files after this TTL. */
export const EXPORT_FILE_TTL_MS = 6 * 60 * 60 * 1000;

export const EXPORT_DIR =
  process.env.EXPORT_DIR?.trim() ||
  (process.env.NODE_ENV === "production"
    ? "/app/data/exports"
    : join(process.cwd(), "data/exports"));

export const STALE_EXPORT_ERROR =
  "Export interrupted by server restart or timeout";

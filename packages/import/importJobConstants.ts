/** Jobs without progress longer than this are treated as stale on recovery. */
export const STALE_IMPORT_JOB_MS = 10 * 60 * 1000;

export const STALE_IMPORT_JOB_MESSAGE =
  "Import interrupted by server restart or timeout";

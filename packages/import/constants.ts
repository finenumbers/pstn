/**
 * Import policy: ALWAYS load 100% of rows from ALL four MinDigital CSV files.
 * No row caps, no sampling, no partial swap. If any file is incomplete or rows
 * are skipped during parse, the import MUST fail before touching production data.
 */
export const USER_AGENT =
  "Mozilla/5.0 (compatible; PSTN-Analytics/1.0; +https://github.com/pstn-analytics)";

/** All four open-data files — every import must load each file in full. */
export const SOURCE_FILES = [
  {
    key: "ABC-3xx",
    url: "https://opendata.digital.gov.ru/downloads/ABC-3xx.csv",
  },
  {
    key: "ABC-4xx",
    url: "https://opendata.digital.gov.ru/downloads/ABC-4xx.csv",
  },
  {
    key: "ABC-8xx",
    url: "https://opendata.digital.gov.ru/downloads/ABC-8xx.csv",
  },
  {
    key: "DEF-9xx",
    url: "https://opendata.digital.gov.ru/downloads/DEF-9xx.csv",
  },
] as const;

export type SourceFileKey = (typeof SOURCE_FILES)[number]["key"];

export const BATCH_SIZE = 5000;

export type LoadedRowsBySource = Record<SourceFileKey, number>;

export function emptyLoadedRowsBySource(): LoadedRowsBySource {
  return {
    "ABC-3xx": 0,
    "ABC-4xx": 0,
    "ABC-8xx": 0,
    "DEF-9xx": 0,
  };
}

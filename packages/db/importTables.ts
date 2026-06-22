export const RANGES_TABLE = "number_ranges" as const;
export const RANGES_STAGING_TABLE = "number_ranges_staging" as const;

export type ImportRangesTable =
  | typeof RANGES_TABLE
  | typeof RANGES_STAGING_TABLE;

export const IMPORT_RANGES_TABLES: readonly ImportRangesTable[] = [
  RANGES_TABLE,
  RANGES_STAGING_TABLE,
];

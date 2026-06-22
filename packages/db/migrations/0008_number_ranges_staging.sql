-- Staging table for atomic import swap (Phase 1: import reliability).
CREATE TABLE IF NOT EXISTS number_ranges_staging (
  LIKE number_ranges INCLUDING ALL
);

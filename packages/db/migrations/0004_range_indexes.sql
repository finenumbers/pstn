CREATE INDEX IF NOT EXISTS "idx_ranges_start_end" ON "number_ranges" ("range_start", "range_end");
CREATE INDEX IF NOT EXISTS "idx_ranges_settlement" ON "number_ranges" ("settlement");

ALTER TABLE "dataset_snapshots"
  ADD COLUMN IF NOT EXISTS "has_full" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "has_diff" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "row_count" integer NOT NULL DEFAULT 0;

UPDATE "dataset_snapshots"
SET
  "has_diff" = true,
  "has_full" = false
WHERE EXISTS (
  SELECT 1 FROM "number_range_diffs" d WHERE d.snapshot_id = "dataset_snapshots".id
);

CREATE TABLE IF NOT EXISTS "number_range_full_snapshots" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "snapshot_id" uuid NOT NULL REFERENCES "dataset_snapshots" ("id") ON DELETE CASCADE,
  "abc" varchar(3) NOT NULL,
  "range_start" bigint NOT NULL,
  "range_end" bigint NOT NULL,
  "capacity" integer NOT NULL,
  "operator" text NOT NULL,
  "gar_territory" text NOT NULL,
  "region" text NOT NULL,
  "inn" varchar(12) NOT NULL DEFAULT '',
  "abc_gap_before" boolean NOT NULL DEFAULT false,
  "abc_gap_after" boolean NOT NULL DEFAULT false,
  "source_file" varchar(16) NOT NULL,
  CONSTRAINT "number_range_full_snapshots_range_order" CHECK ("range_end" >= "range_start")
);

CREATE INDEX IF NOT EXISTS "idx_number_range_full_snapshots_snapshot"
  ON "number_range_full_snapshots" ("snapshot_id");

CREATE INDEX IF NOT EXISTS "idx_number_range_full_snapshots_snapshot_abc_start"
  ON "number_range_full_snapshots" ("snapshot_id", "abc", "range_start");

CREATE INDEX IF NOT EXISTS "idx_number_range_full_snapshots_operator_trgm"
  ON "number_range_full_snapshots" USING gin ("operator" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_number_range_full_snapshots_region_trgm"
  ON "number_range_full_snapshots" USING gin ("region" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_number_range_full_snapshots_gar_territory_trgm"
  ON "number_range_full_snapshots" USING gin ("gar_territory" gin_trgm_ops);

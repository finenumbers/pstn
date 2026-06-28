CREATE TABLE IF NOT EXISTS "dataset_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind" varchar(16) NOT NULL DEFAULT 'diff',
  "load_date" date NOT NULL,
  "job_id" uuid REFERENCES "import_jobs" ("id"),
  "added_count" integer NOT NULL DEFAULT 0,
  "changed_count" integer NOT NULL DEFAULT 0,
  "removed_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "dataset_snapshots_load_date_unique" UNIQUE ("load_date")
);

CREATE TABLE IF NOT EXISTS "number_range_diffs" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "snapshot_id" uuid NOT NULL REFERENCES "dataset_snapshots" ("id") ON DELETE CASCADE,
  "change_type" varchar(16) NOT NULL,
  "abc" varchar(3) NOT NULL,
  "range_start" bigint NOT NULL,
  "range_end" bigint NOT NULL,
  "capacity" integer NOT NULL,
  "operator" text NOT NULL,
  "gar_territory" text NOT NULL,
  "region" text NOT NULL,
  "inn" varchar(12) NOT NULL DEFAULT '',
  "prev_range_start" bigint,
  "prev_range_end" bigint,
  "prev_capacity" integer,
  "prev_operator" text,
  "prev_region" text,
  "prev_gar_territory" text,
  "prev_inn" varchar(12),
  CONSTRAINT "number_range_diffs_range_order" CHECK ("range_end" >= "range_start")
);

CREATE INDEX IF NOT EXISTS "idx_number_range_diffs_snapshot"
  ON "number_range_diffs" ("snapshot_id");

CREATE INDEX IF NOT EXISTS "idx_number_range_diffs_snapshot_abc_start"
  ON "number_range_diffs" ("snapshot_id", "abc", "range_start");

CREATE INDEX IF NOT EXISTS "idx_number_range_diffs_operator_trgm"
  ON "number_range_diffs" USING gin ("operator" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_number_range_diffs_region_trgm"
  ON "number_range_diffs" USING gin ("region" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_number_range_diffs_gar_territory_trgm"
  ON "number_range_diffs" USING gin ("gar_territory" gin_trgm_ops);

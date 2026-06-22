CREATE TABLE IF NOT EXISTS "number_ranges" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "abc" varchar(3) NOT NULL,
  "range_start" bigint NOT NULL,
  "range_end" bigint NOT NULL,
  "capacity" integer NOT NULL,
  "operator" text NOT NULL,
  "settlement" text NOT NULL,
  "region" text NOT NULL,
  "inn" varchar(12) NOT NULL DEFAULT '',
  "source_file" varchar(16) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "chk_range_order" CHECK ("range_end" >= "range_start")
);

CREATE TABLE IF NOT EXISTS "operators_dict" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL UNIQUE,
  "inn" varchar(12) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS "regions_dict" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS "settlements_dict" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS "abc_dict" (
  "code" varchar(3) PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS "import_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "status" varchar(20) NOT NULL,
  "triggered_by" varchar(20) DEFAULT 'manual',
  "started_at" timestamptz,
  "finished_at" timestamptz,
  "rows_loaded" integer DEFAULT 0,
  "error_message" text,
  "files_changed" boolean DEFAULT false,
  "progress_phase" varchar(64),
  "files_processed" integer DEFAULT 0,
  "files_total" integer DEFAULT 4,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "source_file_snapshots" (
  "file_key" varchar(32) PRIMARY KEY,
  "url" text NOT NULL,
  "content_length" bigint,
  "sha256" char(64) NOT NULL,
  "downloaded_at" timestamptz NOT NULL,
  "import_job_id" uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS "dataset_meta" (
  "id" smallint PRIMARY KEY DEFAULT 1,
  "last_success_at" timestamptz,
  "source_validity_at" timestamptz,
  "last_job_id" uuid,
  "total_rows" integer,
  CONSTRAINT "dataset_meta_singleton" CHECK ("id" = 1)
);

CREATE INDEX IF NOT EXISTS "idx_ranges_abc_start" ON "number_ranges" ("abc", "range_start");
CREATE INDEX IF NOT EXISTS "idx_ranges_operator" ON "number_ranges" ("operator");
CREATE INDEX IF NOT EXISTS "idx_ranges_region" ON "number_ranges" ("region");
CREATE INDEX IF NOT EXISTS "idx_ranges_inn" ON "number_ranges" ("inn");
CREATE INDEX IF NOT EXISTS "idx_ranges_capacity" ON "number_ranges" ("capacity");
CREATE INDEX IF NOT EXISTS "idx_ranges_abc_operator" ON "number_ranges" ("abc", "operator");

-- pg_trgm for facet search (Phase 3)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "idx_ranges_operator_trgm" ON "number_ranges" USING gin ("operator" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_ranges_region_trgm" ON "number_ranges" USING gin ("region" gin_trgm_ops);

-- Materialized view for ABC summary (Phase 3)
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_abc_summary" AS
SELECT abc, COUNT(*)::int AS range_count, SUM(capacity)::bigint AS total_capacity
FROM number_ranges
GROUP BY abc;

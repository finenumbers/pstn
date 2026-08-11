CREATE TABLE IF NOT EXISTS "export_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "status" varchar(20) NOT NULL,
  "filters_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "dataset" varchar(80),
  "as_of" date,
  "total_rows" integer NOT NULL DEFAULT 0,
  "rows_written" integer NOT NULL DEFAULT 0,
  "file_path" text,
  "error_message" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "started_at" timestamptz,
  "finished_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "idx_export_jobs_status_updated_at"
  ON "export_jobs" ("status", "updated_at");

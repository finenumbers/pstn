ALTER TABLE import_jobs
  ADD COLUMN IF NOT EXISTS file_rows jsonb NOT NULL DEFAULT '{}'::jsonb;

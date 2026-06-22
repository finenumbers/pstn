ALTER TABLE import_jobs
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE import_jobs SET updated_at = COALESCE(started_at, created_at, now());

CREATE INDEX IF NOT EXISTS idx_import_jobs_status_updated_at
  ON import_jobs (status, updated_at);

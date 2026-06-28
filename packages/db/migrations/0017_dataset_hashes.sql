ALTER TABLE "dataset_meta"
  ADD COLUMN IF NOT EXISTS "source_hashes" jsonb;

ALTER TABLE "import_jobs"
  ADD COLUMN IF NOT EXISTS "skip_reason" varchar(64);

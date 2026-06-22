ALTER TABLE "dataset_meta"
  ADD COLUMN IF NOT EXISTS "source_validity_at" timestamptz;

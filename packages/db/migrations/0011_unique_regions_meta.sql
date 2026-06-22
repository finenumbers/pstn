ALTER TABLE "dataset_meta"
  ADD COLUMN IF NOT EXISTS "unique_regions" integer;

UPDATE "dataset_meta" dm
SET
  "unique_regions" = (SELECT COUNT(DISTINCT "region")::int FROM "number_ranges")
WHERE dm."id" = 1
  AND EXISTS (SELECT 1 FROM "number_ranges" LIMIT 1);

ALTER TABLE "dataset_meta"
  ADD COLUMN IF NOT EXISTS "unique_gar_territories" integer;

UPDATE "dataset_meta" dm
SET
  "unique_gar_territories" = (
    SELECT COUNT(DISTINCT "gar_territory")::int FROM "number_ranges"
  )
WHERE dm."id" = 1
  AND EXISTS (SELECT 1 FROM "number_ranges" LIMIT 1);

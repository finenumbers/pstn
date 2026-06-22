ALTER TABLE "dataset_meta"
  ADD COLUMN IF NOT EXISTS "total_capacity" bigint,
  ADD COLUMN IF NOT EXISTS "unique_operators" integer;

UPDATE "dataset_meta" dm
SET
  "total_rows" = (SELECT COUNT(*)::int FROM "number_ranges"),
  "total_capacity" = (SELECT COALESCE(SUM("capacity"), 0)::bigint FROM "number_ranges"),
  "unique_operators" = (SELECT COUNT(DISTINCT "operator")::int FROM "number_ranges")
WHERE dm."id" = 1
  AND EXISTS (SELECT 1 FROM "number_ranges" LIMIT 1);

ALTER TABLE "number_ranges"
  ADD COLUMN IF NOT EXISTS "gar_territory" text NOT NULL DEFAULT '';

ALTER TABLE "number_ranges"
  ALTER COLUMN "gar_territory" DROP DEFAULT;

ALTER TABLE "number_ranges"
  DROP COLUMN IF EXISTS "settlement";

ALTER TABLE "number_ranges_staging"
  ADD COLUMN IF NOT EXISTS "gar_territory" text NOT NULL DEFAULT '';

ALTER TABLE "number_ranges_staging"
  ALTER COLUMN "gar_territory" DROP DEFAULT;

ALTER TABLE "number_ranges_staging"
  DROP COLUMN IF EXISTS "settlement";

DROP TABLE IF EXISTS "settlements_dict";

CREATE TABLE IF NOT EXISTS "gar_territories_dict" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL UNIQUE
);

DROP INDEX IF EXISTS "idx_ranges_settlement";
DROP INDEX IF EXISTS "idx_ranges_settlement_trgm";

CREATE INDEX IF NOT EXISTS "idx_ranges_gar_territory" ON "number_ranges" ("gar_territory");
CREATE INDEX IF NOT EXISTS "idx_ranges_gar_territory_trgm" ON "number_ranges" USING gin ("gar_territory" gin_trgm_ops);

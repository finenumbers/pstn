ALTER TABLE "number_ranges"
  ADD COLUMN IF NOT EXISTS "settlement" text NOT NULL DEFAULT '';

ALTER TABLE "number_ranges"
  ALTER COLUMN "settlement" DROP DEFAULT;

CREATE TABLE IF NOT EXISTS "settlements_dict" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS "idx_ranges_settlement" ON "number_ranges" ("settlement");
CREATE INDEX IF NOT EXISTS "idx_ranges_settlement_trgm" ON "number_ranges" USING gin ("settlement" gin_trgm_ops);

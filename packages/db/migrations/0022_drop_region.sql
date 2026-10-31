-- Drop the Region column from live tables, snapshots, and diffs.
-- Region-only changed rows are removed first. Capacity is not compared:
-- merged segments store the full span in capacity and the first piece in prev_capacity.

BEGIN;

DELETE FROM number_range_diffs
WHERE change_type = 'changed'
  AND prev_operator IS NOT DISTINCT FROM operator
  AND prev_gar_territory IS NOT DISTINCT FROM gar_territory
  AND prev_inn IS NOT DISTINCT FROM inn
  AND prev_region IS DISTINCT FROM region;

UPDATE dataset_snapshots AS s
SET
  added_count = COALESCE((
    SELECT COUNT(*)::int
    FROM number_range_diffs AS d
    WHERE d.snapshot_id = s.id
      AND d.change_type = 'added'
  ), 0),
  changed_count = COALESCE((
    SELECT COUNT(*)::int
    FROM number_range_diffs AS d
    WHERE d.snapshot_id = s.id
      AND d.change_type = 'changed'
  ), 0),
  removed_count = COALESCE((
    SELECT COUNT(*)::int
    FROM number_range_diffs AS d
    WHERE d.snapshot_id = s.id
      AND d.change_type = 'removed'
  ), 0),
  has_diff = EXISTS (
    SELECT 1
    FROM number_range_diffs AS d
    WHERE d.snapshot_id = s.id
  );

COMMIT;

DO $$
DECLARE
  idx record;
BEGIN
  FOR idx IN
    SELECT n.nspname AS schema_name, ci.relname AS index_name
    FROM pg_index AS i
    JOIN pg_class AS ct ON ct.oid = i.indrelid
    JOIN pg_class AS ci ON ci.oid = i.indexrelid
    JOIN pg_namespace AS n ON n.oid = ct.relnamespace
    JOIN pg_attribute AS a
      ON a.attrelid = ct.oid
     AND a.attnum = ANY (i.indkey)
    WHERE n.nspname = 'public'
      AND ct.relname IN (
        'number_ranges',
        'number_ranges_staging',
        'number_range_diffs',
        'number_range_full_snapshots'
      )
      AND a.attname IN ('region', 'prev_region')
      AND NOT i.indisprimary
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', idx.schema_name, idx.index_name);
  END LOOP;
END $$;

ALTER TABLE number_ranges DROP COLUMN IF EXISTS region;
ALTER TABLE number_ranges_staging DROP COLUMN IF EXISTS region;
ALTER TABLE number_range_diffs DROP COLUMN IF EXISTS region;
ALTER TABLE number_range_diffs DROP COLUMN IF EXISTS prev_region;
ALTER TABLE number_range_full_snapshots DROP COLUMN IF EXISTS region;

DROP TABLE IF EXISTS regions_dict;

ALTER TABLE dataset_meta DROP COLUMN IF EXISTS unique_regions;

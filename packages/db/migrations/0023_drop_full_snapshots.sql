BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM import_jobs
    WHERE status IN ('pending', 'running')
      AND updated_at > now() - interval '2 minutes'
  ) THEN
    RAISE EXCEPTION '0023 refused: import is in progress';
  END IF;

  IF EXISTS (
    SELECT 1 FROM export_jobs
    WHERE status IN ('pending', 'running')
      AND updated_at > now() - interval '2 minutes'
  ) THEN
    RAISE EXCEPTION '0023 refused: export is in progress';
  END IF;
END $$;

DROP TABLE IF EXISTS number_range_full_snapshots;

DELETE FROM dataset_snapshots s
WHERE NOT EXISTS (
  SELECT 1 FROM number_range_diffs d WHERE d.snapshot_id = s.id
);

UPDATE dataset_snapshots
SET kind = 'diff', has_diff = true;

ALTER TABLE dataset_snapshots
  DROP COLUMN IF EXISTS has_full,
  DROP COLUMN IF EXISTS row_count;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'export_jobs'
      AND column_name = 'as_of'
  ) THEN
    DELETE FROM export_jobs
    WHERE dataset LIKE 'full:%' OR as_of IS NOT NULL;
    ALTER TABLE export_jobs DROP COLUMN as_of;
  ELSE
    DELETE FROM export_jobs WHERE dataset LIKE 'full:%';
  END IF;
END $$;

COMMIT;

DROP MATERIALIZED VIEW IF EXISTS mv_abc_summary;

DROP TABLE IF EXISTS source_file_snapshots;

ALTER TABLE import_jobs DROP COLUMN IF EXISTS files_changed;

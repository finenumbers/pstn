-- Staging is a bulk-load buffer; secondary indexes slow INSERT on large CSV files.
-- Indexes are rebuilt on staging before swap (see ensureStagingProductionIndexes).
DO $$
DECLARE idx record;
BEGIN
  FOR idx IN
    SELECT ci.relname AS index_name
    FROM pg_index i
    JOIN pg_class ct ON ct.oid = i.indrelid
    JOIN pg_class ci ON ci.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = ct.relnamespace
    WHERE n.nspname = 'public'
      AND ct.relname = 'number_ranges_staging'
      AND NOT i.indisprimary
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', 'public', idx.index_name);
  END LOOP;
END $$;

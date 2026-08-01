import { importPool } from "@/packages/db";
import { RANGES_STAGING_TABLE } from "@/packages/db/importTables";

/** Drop non-primary indexes on staging so bulk INSERT stays fast. */
export async function dropStagingSecondaryIndexes(): Promise<void> {
  await importPool().query(`
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
          AND ct.relname = '${RANGES_STAGING_TABLE}'
          AND NOT i.indisprimary
      LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I.%I', 'public', idx.index_name);
      END LOOP;
    END $$;
  `);
}

/**
 * Mirror production indexes onto staging before atomic swap.
 * After RENAME, production keeps these indexes for UI/search performance.
 */
export async function ensureStagingProductionIndexes(): Promise<void> {
  const result = await importPool().query<{
    indexname: string;
    indexdef: string;
  }>(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'number_ranges'
    ORDER BY indexname
  `);

  for (const row of result.rows) {
    const stagingIndexName = row.indexname.replace(
      /^idx_ranges_/,
      "idx_staging_ranges_"
    );
    let definition = row.indexdef.replace(
      " ON public.number_ranges ",
      ` ON public.${RANGES_STAGING_TABLE} `
    );
    definition = definition.replace(
      `CREATE INDEX ${row.indexname}`,
      `CREATE INDEX IF NOT EXISTS ${stagingIndexName}`
    );
    definition = definition.replace(
      `CREATE UNIQUE INDEX ${row.indexname}`,
      `CREATE UNIQUE INDEX IF NOT EXISTS ${stagingIndexName}`
    );
    await importPool().query(definition);
  }
}

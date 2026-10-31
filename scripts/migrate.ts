import { existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import pg from "pg";

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const migrationsDir = path.join(process.cwd(), "packages/db/migrations");
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const client = new pg.Client({ connectionString });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const file of files) {
    const applied = await client.query(
      "SELECT 1 FROM schema_migrations WHERE filename = $1",
      [file]
    );
    if (applied.rowCount && applied.rowCount > 0) {
      console.log(`Skip migration: ${file}`);
      continue;
    }

    if (file === "0023_drop_full_snapshots.sql") {
      await purgeLegacyFullExportFiles(client);
    }

    const sql = readFileSync(path.join(migrationsDir, file), "utf-8");
    console.log(`Applying migration: ${file}`);
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (filename) VALUES ($1)",
      [file]
    );
  }

  console.log("All migrations completed successfully");
  await client.end();
}

async function purgeLegacyFullExportFiles(client: pg.Client): Promise<void> {
  const live = await client.query(
    `SELECT 1
     WHERE EXISTS (
       SELECT 1 FROM import_jobs
       WHERE status IN ('pending', 'running')
         AND updated_at > now() - interval '2 minutes'
     ) OR EXISTS (
       SELECT 1 FROM export_jobs
       WHERE status IN ('pending', 'running')
         AND updated_at > now() - interval '2 minutes'
     )`
  );
  if ((live.rowCount ?? 0) > 0) {
    throw new Error("0023 refused: import or export is in progress");
  }

  const column = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'export_jobs'
       AND column_name = 'as_of'`
  );
  const hasAsOf = (column.rowCount ?? 0) > 0;
  const files = await client.query<{ file_path: string }>(
    hasAsOf
      ? `SELECT file_path FROM export_jobs
         WHERE file_path IS NOT NULL
           AND (dataset LIKE 'full:%' OR as_of IS NOT NULL)`
      : `SELECT file_path FROM export_jobs
         WHERE file_path IS NOT NULL AND dataset LIKE 'full:%'`
  );

  const exportDir = path.resolve(
    process.env.EXPORT_DIR?.trim() ||
      (process.env.NODE_ENV === "production"
        ? "/app/data/exports"
        : path.join(process.cwd(), "data/exports"))
  );

  for (const row of files.rows) {
    const filePath = row.file_path;
    if (!filePath || filePath.includes("..")) continue;
    const resolved = path.resolve(filePath);
    const relative = path.relative(exportDir, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      console.warn(`skip export file outside EXPORT_DIR: ${filePath}`);
      continue;
    }
    if (existsSync(resolved)) {
      unlinkSync(resolved);
    }
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
